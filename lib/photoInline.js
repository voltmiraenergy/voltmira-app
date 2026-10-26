// lib/photoInline.js — SERVER only. The makers' product photos for the printed offer (PrintSheet.jsx), fetched once
// and put into the page as data: images. A photo hotlinked from a maker's site sometimes refuses or times out, and the
// PDF then printed a broken-image icon next to the equipment; fetched first, a photo that fails is simply left out.
// Only https images under 600 KB, 3 seconds each, remembered for a day.
const cache = new Map();   // url -> { at, data }
const DAY = 864e5;

async function one(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < DAY) return hit.data;
  let data = null;
  try {
    if (!/^https:\/\//.test(url)) throw new Error("not https");
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), headers: { accept: "image/*" } });
    const type = String(res.headers.get("content-type") || "").split(";")[0].trim();
    if (!res.ok || !/^image\/(png|jpe?g|webp|gif)$/.test(type)) throw new Error("not an image");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 600_000 || buf.length < 200) throw new Error("size");
    data = `data:${type};base64,${buf.toString("base64")}`;
  } catch { data = null; }
  cache.set(url, { at: Date.now(), data });
  return data;
}

/** { url: dataUri } for the photos that loaded; the others are absent. */
export async function inlinePhotos(urls) {
  const list = [...new Set((urls || []).filter(Boolean))].slice(0, 8);
  const out = {};
  await Promise.all(list.map(async (u) => { const d = await one(u); if (d) out[u] = d; }));
  return out;
}
