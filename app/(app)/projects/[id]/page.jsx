// Server wrapper: fetch project + engine settings, hand to client editor.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../../lib/supabase.js";
import { defaultEngineSettings } from "@voltmira/engine";
import { t, normLang } from "../../../../lib/i18n.js";
import Editor from "./editor.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote — VoltMira" };

export default async function ProjectPage({ params }) {
  const sb = supabaseServer();
  // The project fetch is RLS-scoped to the caller's company (projects_all uses
  // the security-definer my_company_id(), no recursion).
  const [{ data: p }, { data: co }, { data: prop }, { data: catalog }] = await Promise.all([
    sb.from("projects").select("*").eq("id", params.id).single(),
    sb.from("companies").select("name, engine, currency, prosumer_limit_kw, subsidy_amount_ron, lang").single(),
    sb.from("proposals").select("created_at").eq("project_id", params.id).limit(1).maybeSingle(),
    sb.from("products").select("*").order("created_at"),   // catalog for the bill of materials
  ]);
  if (!p) return (
    <div className="empty" style={{ maxWidth: 460, margin: "40px auto" }}>
      <b>{t("proj_not_found", normLang(co?.lang))}</b>
      <Link className="fchip" style={{ marginTop: 8, display: "inline-block" }} href="/projects">{t("back_projects", normLang(co?.lang))}</Link>
    </div>
  );
  // Team list for the owner dropdown, via service role scoped to THIS project's
  // company (the user already proved access to the project above). Reading
  // `profiles` under RLS recurses, so we can't use the user session here.
  const { data: team } = await supabaseAdmin()
    .from("profiles").select("id, name, email").eq("company_id", p.company_id).order("created_at");

  const E = {
    ...defaultEngineSettings(),
    ...(co?.engine || {}),
    subsidyAmountRon: Number(co?.subsidy_amount_ron ?? 20000),
  };
  return <Editor initial={p} engineSettings={E} team={team || []} catalog={catalog || []}
    prosumerLimitKw={Number(co?.prosumer_limit_kw ?? 10.8)} lang={normLang(co?.lang)}
    proposalSentAt={prop?.created_at || null} companyName={co?.name || "VoltMira"} />;
}
