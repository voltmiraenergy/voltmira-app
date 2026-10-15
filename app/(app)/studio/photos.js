// app/(app)/studio/photos.js — real photo capture for Studio, shared by the
// Site & Roof step and the Installation step. Both used to have decorative
// stand-ins (a boolean toggle, four static gradient boxes) that never held an
// actual file. This reads a real file, resizes it client-side to a small JPEG
// before storing (a handful of full-resolution photos would blow past
// localStorage's quota fast; a 480px-wide JPEG is typically 20-60KB), and
// persists it per job through the same readJSON/writeJSON as the rest of
// Studio, so the photos are saved to the workspace along with the job.
import { readJSON, writeJSON } from "./jobs-data.js";

export const photoKey = (jobId, group) => `voltmira_studio_photos_${jobId}_${group}`;

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

export function loadPhotos(jobId, group) {
  const v = readJSON(photoKey(jobId, group), []);
  return Array.isArray(v) ? v : [];
}
export function savePhotos(jobId, group, list) {
  writeJSON(photoKey(jobId, group), list);
}
