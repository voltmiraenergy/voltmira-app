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
  return <CatalogManager initial={products || []} lang={lang} />;
}
