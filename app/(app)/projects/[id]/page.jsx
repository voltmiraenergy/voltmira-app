// Server wrapper: fetch project + engine settings, hand to client editor.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../../lib/supabase.js";
import { companyEngine } from "../../../../lib/engineSettings.js";
import { t, normLang } from "../../../../lib/i18n.js";
import { calibrateYield } from "../../../../lib/yieldCalibration.js";
import Editor from "./editor.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote — VoltMira" };

export default async function ProjectPage({ params }) {
  const sb = supabaseServer();
  // The project fetch is RLS-scoped to the caller's company (projects_all uses
  // the security-definer my_company_id(), no recursion).
  const [{ data: p }, { data: co }, { data: prop }, { data: catalog }, { data: signedProp }] = await Promise.all([
    sb.from("projects").select("*").eq("id", params.id).single(),
    sb.from("companies").select("name, logo_url, engine, currency, prosumer_limit_kw, subsidy_amount_ron, lang").single(),
    sb.from("proposals").select("created_at").eq("project_id", params.id).limit(1).maybeSingle(),
    sb.from("products").select("*").order("created_at"),   // catalog for the bill of materials
    // the accepted + signed proposal, so the installer can view the signature back
    // (select("*") stays graceful before add-proposal-signature.sql has run).
    sb.from("proposals").select("*").eq("project_id", params.id)
      .not("accepted_at", "is", null).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
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

  // Live FX comes in via companyEngine so the editor's grant maths matches the
  // dashboard's. The editor is a client component, so the rate has to arrive as
  // a prop — it cannot fetch it itself.
  const E = {
    ...(await companyEngine(co)),
    subsidyAmountRon: Number(co?.subsidy_amount_ron ?? 20000),
  };
  const signed = signedProp ? {
    signature: signedProp.signature || null,
    signerName: signedProp.signer_name || null,
    acceptedAt: signedProp.accepted_at || null,
    signedIp: signedProp.signed_ip || null,
    signedUa: signedProp.signed_ua || null,
  } : null;

  // What this installer's own installed base says the P50 promise is worth.
  // PVGIS models a location; it doesn't know this company's mounting, shading
  // habits or roof orientations — the gap between promised and measured does,
  // and it's specific to their work in their region. Computed here and offered
  // to the installer; never applied on its own (see lib/yieldCalibration.js).
  const calibration = await companyYieldCalibration(sb, E);

  return <Editor initial={p} engineSettings={E} team={team || []} catalog={catalog || []}
    prosumerLimitKw={Number(co?.prosumer_limit_kw ?? 10.8)} lang={normLang(co?.lang)}
    proposalSentAt={prop?.created_at || null} companyName={co?.name || "VoltMira"} companyLogo={co?.logo_url || ""}
    signed={signed} calibration={calibration} />;
}

/**
 * Measure every won system that has readings against the yield its own quote
 * promised. Returns a neutral, non-confident result when the table doesn't
 * exist yet or nothing has been recorded — the editor then shows nothing.
 */
async function companyYieldCalibration(sb, E) {
  const NONE = { factor: 1, systems: 0, months: 0, spread: 0, confident: false, ratios: [] };
  const { data: readings, error } = await sb
    .from("production_readings").select("project_id, month, kwh");
  if (error || !readings?.length) return NONE;

  const byProject = new Map();
  for (const r of readings) {
    if (!byProject.has(r.project_id)) byProject.set(r.project_id, []);
    byProject.get(r.project_id).push({ month: r.month, kwh: Number(r.kwh) || 0 });
  }

  const { data: installed } = await sb.from("projects")
    .select("id, kw, yield_per_kwp, monthly_yield_shape, commissioned_at")
    .in("id", [...byProject.keys()]);

  return calibrateYield((installed || []).map((p) => ({
    kw: Number(p.kw) || 0,
    // Only a project with a real PVGIS lookup has a promise worth measuring;
    // the engine default is a national average, not a claim about this roof.
    yieldPerKwp: Number(p.yield_per_kwp) || 0,
    monthlyShape: p.monthly_yield_shape || null,
    commissionedAt: p.commissioned_at || null,
    readings: byProject.get(p.id) || [],
  })), E?.bands?.expc?.degr ?? 0.5);
}
