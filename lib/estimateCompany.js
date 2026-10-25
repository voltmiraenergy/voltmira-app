// lib/estimateCompany.js — the workspace behind an estimate page address: its own address (companies.public_slug,
// add-quote-fast.sql) or, as for the older widget link, its id. Before the SQL has run the id still works, without
// the colour; a missing column never breaks the page. Server only: the caller passes the service-role client.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = "id, name, short_name, logo_url, lang, default_market, notify_calls";
const MORE = ", brand_color, lead_score_weights, service_districts";

/** @returns {Promise<object|null>} */
export async function companyForPage(db, key) {
  const k = String(key || "").toLowerCase();
  const byId = UUID.test(k);
  if (!byId && !/^[a-z0-9-]{3,40}$/.test(k)) return null;
  const run = (cols) => {
    const q = db.from("companies").select(cols);
    return (byId ? q.eq("id", k) : q.eq("public_slug", k)).maybeSingle();
  };
  try {
    let { data, error } = await run(BASE + MORE);
    // the newer columns are not there yet: an id still finds the workspace, an address cannot
    if (error && byId) ({ data, error } = await run(BASE));
    return error ? null : data || null;
  } catch {
    return null;
  }
}
