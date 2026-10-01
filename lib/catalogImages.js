// lib/catalogImages.js — hero images for the supplier-catalog grid.
//
// Primary source: each catalog entry's own `photoUrl` (lib/supplierCatalog.js)
// — the real manufacturer's own product photo for that specific SKU (or, per
// that file's per-entry notes, the closest real same-brand product-line photo
// where an exact SKU match wasn't findable). Deliberately NOT read by
// addProduct() — the "Add to my catalog" flow still sends image_url:"" today,
// unchanged; these hotlinks are presentation-only in this browser.
//
// Fallback, for the handful of entries with no `photoUrl` (an unsourceable
// brand, or the catalog's own admittedly-fictional "generic import" battery):
// the same generic, freely-licensed Unsplash/Wikimedia photos this file used
// before real per-SKU photos were sourced — representative of the equipment
// KIND, not a claim of the exact pictured SKU.
//
// /placeholder.svg (public/placeholder.svg) is the CSS-level fallback below
// that (an <img onError> swap) for the rare case ANY hotlink — real or
// generic — is briefly unreachable.

const SIZE_BY_KIND = {
  panel: { width: 320, height: 220 },
  inverter: { width: 240, height: 240 },
  battery: { width: 240, height: 240 },
  mounting: { width: 320, height: 200 },
};
const DEFAULT_SIZE = { width: 280, height: 220 };

// Same URLs as lib/actions.js's STARTER_CATALOG `IMG` map — duplicated here
// (rather than imported) because actions.js is a "use server" module whose
// plain data isn't meant to be pulled into client components; kept in sync by
// eye, both being small, stable, hand-curated lists.
const PHOTOS_BY_KIND = {
  panel: [
    "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=640&q=70",
    "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=640&q=70",
    "https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=640&q=70",
  ],
  inverter: [
    "https://upload.wikimedia.org/wikipedia/commons/1/1c/SolarEdge-Inverter.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/6/68/Onduleur_pour_photovolta%C3%AFque.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Inverter_Fronius_%3D_Sunways_NT_6000-01ASD.jpg/500px-Inverter_Fronius_%3D_Sunways_NT_6000-01ASD.jpg",
  ],
  battery: [
    // Two direct file URLs only — no Special:FilePath redirect hop, and both
    // filenames name the equipment CLASS ("household battery storage"), not
    // a specific competitor's branded product.
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Household_battery_storage.png/500px-Household_battery_storage.png",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Household_solar_energy_storage_system.jpg/500px-Household_solar_energy_storage_system.jpg",
  ],
  mounting: [
    "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?auto=format&fit=crop&w=640&q=70",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Photovoltaic_mounting_system.jpg/500px-Photovoltaic_mounting_system.jpg",
  ],
};

/** A small, non-cryptographic string hash — just enough to pick a stable
 * index into a kind's photo pool from a product's own id. */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * The hero photo for one catalog row. Prefers the product's own real
 * manufacturer photo (`photoUrl`, set in lib/supplierCatalog.js); falls back
 * to a generic, kind-representative photo — stable across re-renders (same
 * product -> same fallback photo, picked by hashing its id rather than its
 * position, so re-sorting/filtering the grid never reshuffles it) — for the
 * few entries with no sourced photo; falls back again to the local
 * placeholder for a kind with no photo pool at all.
 * @param {{kind?:string, id?:string, brand?:string, model?:string, photoUrl?:string}} product
 */
export function productImage(product) {
  if (product?.photoUrl) return product.photoUrl;
  const pool = PHOTOS_BY_KIND[product?.kind];
  if (!pool || !pool.length) return placeholderImage(product);
  const idx = hashStr(String(product?.id || product?.model || "")) % pool.length;
  return pool[idx];
}

/**
 * The local generic placeholder — used as the initial src for a kind with no
 * real photo pool, and as the <img onError> fallback everywhere else so a
 * momentarily-unreachable hotlink never shows a broken-image icon.
 */
export function placeholderImage(product) {
  const { width, height } = SIZE_BY_KIND[product?.kind] || DEFAULT_SIZE;
  return `/placeholder.svg?height=${height}&width=${width}`;
}

/** The kind-sized {width,height} pair alone, for callers that lay out the
 * image box themselves (e.g. reserving space before the image is measured). */
export function placeholderSize(kind) {
  return SIZE_BY_KIND[kind] || DEFAULT_SIZE;
}
