// app/(app)/studio/photos.js — real photo capture for Studio, shared by the
// Site & Roof step and the Installation step. Both used to have decorative
// stand-ins (a boolean toggle, four static gradient boxes) that never held an
// actual file. This reads a real file, resizes it client-side to a small JPEG
// before storing (a handful of full-resolution photos would blow past
// localStorage's quota fast; a 480px-wide JPEG is typically 20-60KB), and
// keeps it per job in IndexedDB on the device (lib/idbStore.js: room for
// hundreds, where localStorage holds a few megabytes for all of Studio), and
// sends it to the workspace like the rest of Studio (studio-sync.js), so a
// photo taken on a roof with no signal is kept and reaches the office later.
import { readJSON, writeJSON } from "./jobs-data.js";
import { queueWrite, PHOTO_PREFIX } from "./studio-sync.js";
import { idbGet, idbSet } from "../../../lib/idbStore.js";

export const photoKey = (jobId, group) => `${PHOTO_PREFIX}${jobId}_${group}`;

export function readImageAsDataUrl(file, maxDim = 480) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) { reject(new Error("not_an_image")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("read_failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode_failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** A job's photos in one group: from IndexedDB, moving an older localStorage copy there on the way. */
export async function loadPhotos(jobId, group) {
  const key = photoKey(jobId, group);
  const v = await idbGet(key);
  if (Array.isArray(v)) return v;
  const legacy = readJSON(key, null);
  if (Array.isArray(legacy)) {
    if (await idbSet(key, legacy)) { try { localStorage.removeItem(key); } catch { /* storage disabled */ } }
    return legacy;
  }
  return [];
}

/** Keep the photos on the device and send them to the workspace; without IndexedDB, as before. */
export function savePhotos(jobId, group, list) {
  const key = photoKey(jobId, group);
  idbSet(key, list).then((ok) => {
    if (!ok) { writeJSON(key, list); return; }
    try { localStorage.removeItem(key); } catch { /* storage disabled */ }
    queueWrite(key, list);
  });
}
