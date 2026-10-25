"use client";
// lib/sitePhotos.js — the site photos of a won job, taken on a phone often with no signal: resized to a full but
// sensible size (2048 px, JPEG), kept on the device in IndexedDB with an id of their own, and uploaded to the
// workspace's private bucket (job-photos, under <company_id>/<project_id>/) when the signal is there; the server
// then records each once by that id (lib/jobActions.js registerPhoto), so a photo sent twice is kept once.
import { supabaseBrowser } from "./supabase-browser.js";
import { idbSet, idbDel, idbEntries } from "./idbStore.js";
import { registerPhoto } from "./jobActions.js";

const PREFIX = "vm-sitephoto:";
const keyOf = (projectId, clientId) => `${PREFIX}${projectId}:${clientId}`;
export const newPhotoId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`).replace(/[^\w-]/g, "");

/** A picked photo as a JPEG blob, its longest side at most `maxDim`. */
export function resizeToBlob(file, maxDim = 2048, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) { reject(new Error("not_an_image")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode_failed")); };
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode_failed"))), "image/jpeg", quality);
    };
    img.src = url;
  });
}

/** Keep a photo on the device until it is sent. */
export async function keepPhoto(projectId, { blob, slot, takenAt }) {
  const clientId = newPhotoId();
  await idbSet(keyOf(projectId, clientId), { clientId, projectId, slot, takenAt, blob });
  return clientId;
}

/** The photos of a job still on the device: [{ clientId, slot, takenAt, blob }]. */
export async function pendingPhotos(projectId) {
  return (await idbEntries(`${PREFIX}${projectId}:`)).map(([, v]) => v).filter((v) => v && v.blob);
}

/**
 * Send what waits for a job. @returns {Promise<{ sent: number, failed: number, needsDb?: boolean }>}
 * A photo that fails stays on the device and is tried again next time.
 */
export async function sendPending(projectId, companyId) {
  const out = { sent: 0, failed: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return out;
  const sb = supabaseBrowser();
  for (const p of await pendingPhotos(projectId)) {
    const path = `${companyId}/${projectId}/${p.clientId}.jpg`;
    const up = await sb.storage.from("job-photos").upload(path, p.blob, { upsert: true, contentType: "image/jpeg" });
    if (up.error) { out.failed++; continue; }
    const r = await registerPhoto({ projectId, path, slot: p.slot, clientId: p.clientId, takenAt: p.takenAt }).catch(() => ({ ok: false }));
    if (r.ok) { await idbDel(keyOf(projectId, p.clientId)); out.sent++; }
    else { out.failed++; if (r.error === "needs_db") out.needsDb = true; }
  }
  return out;
}
