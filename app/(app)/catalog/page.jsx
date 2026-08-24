// app/(app)/catalog/page.jsx — the installer's equipment library. Panels,
// inverters, batteries, mounting and extras with real prices, reused on quotes
// to build a bill of materials that drives the real cost.
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { normLang } from "../../../lib/i18n.js";
import CatalogManager from "./CatalogManager.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalog — VoltMira" };

export default async function CatalogPage() {
  const sb = supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const { data: products } = await sb.from("products").select("*").order("created_at", { ascending: true });

  // Live inventory usage: count how many units of each product are tied up in
  // quotes' bills of materials. `committed` = WON deals (units that will leave the
  // warehouse → deducted from availability); `reserved` = open quotes (draft/sent,
  // a soft signal). Derived on read, so it self-corrects when a quote is deleted
  // or marked lost — there's nothing to reverse. Degrades to empty if the bom
  // column isn't there yet (pre add-quote-bom.sql).
  const committed = {}, reserved = {};
  const { data: quotes, error: qErr } = await sb.from("projects").select("bom,status");
  if (!qErr) {
    for (const pr of quotes || []) {
      const bucket = pr.status === "won" ? committed : (pr.status === "lost" ? null : reserved);
      if (!bucket || !Array.isArray(pr.bom)) continue;
      for (const l of pr.bom) {
        const id = l?.productId;
        if (id) bucket[id] = (bucket[id] || 0) + (Number(l.qty) || 0);
      }
    }
  }

  return <CatalogManager initial={products || []} lang={lang} committed={committed} reserved={reserved} />;
}
