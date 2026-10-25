// lib/photoShrink.js — a photo as a JPEG no larger than 1,600 px on its long side, for the roof photo that is sent
// to the quote's roof-photo route (the offer's picture, and the photo laid over the map in the roof designer).
// Read as a data: URL, which the content security policy allows for images (a blob: URL it blocks). Browser only.
export const PHOTO_MAX_PX = 1600;

/** @returns {Promise<Blob>} */
export function shrinkPhoto(file, max = PHOTO_MAX_PX) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) { reject(new Error("not_image")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82);
      };
      img.onerror = () => reject(new Error("decode"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Send a shrunk photo to the quote's roof-photo route. @returns {Promise<string>} its https address */
export async function uploadRoofPhoto(projectId, file) {
  const blob = await shrinkPhoto(file);
  const form = new FormData();
  form.append("photo", blob, "roof.jpg");
  const res = await fetch(`/api/projects/${projectId}/roof-photo`, { method: "POST", body: form });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.url) throw new Error(j.error || "upload");
  return j.url;
}
