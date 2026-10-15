// lib/pvgisCache.js — the pvgis_cache adapter getSolarYield() expects.
//
// Extracted so a THIRD copy of this exact wrapper wasn't pasted into
// createProjectFromLead (lib/actions.js) — app/api/estimate/route.js and
// app/api/pvgis/route.js each already carry their own; this is the one new
// call sites should use.
//
// Resilient on purpose: a cache miss or a DB hiccup must never fail the PVGIS
// call itself, only cost it a slower, uncached lookup.
export function pvgisDbCache(admin) {
  const TTL = 30 * 24 * 3600 * 1000; // 30 days
  return {
    async get(k) {
      try {
        const { data } = await admin.from("pvgis_cache").select("value, created_at").eq("key", k).single();
        if (!data) return null;
        if (Date.now() - new Date(data.created_at).getTime() > TTL) return null;
        return data.value;
      } catch { return null; }
    },
    async set(k, v) {
      try { await admin.from("pvgis_cache").upsert({ key: k, value: v, created_at: new Date().toISOString() }); }
      catch { /* best-effort */ }
    },
  };
}
