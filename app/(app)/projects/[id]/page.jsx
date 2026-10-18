// Server wrapper: fetch project + engine settings, hand to client editor.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../../lib/supabase.js";
import { companyEngine } from "../../../../lib/engineSettings.js";
import { t, normLang } from "../../../../lib/i18n.js";
import { currentUser } from "../../../../lib/session.js";
import { canViewAllProjects, canEditTechnical } from "../../../../lib/rbac.js";
import Editor from "./editor.jsx";
import { cnedEnabled } from "../../../../lib/cnedData.js";
import { appTitle } from "../../../../lib/pageTitle.js";
import { lt } from "../../../../lib/loanText.js";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("col_project");

export default async function ProjectPage(props) {
  const params = await props.params;
  const sb = await supabaseServer();
  // The project fetch is RLS-scoped to the caller's company (projects_all uses
  // the security-definer my_company_id(), no recursion).
  const [{ data: p }, { data: co }, { data: prop }, { data: catalog }, { data: signedProp }, { data: wl }] = await Promise.all([
    sb.from("projects").select("*").eq("id", params.id).single(),
    sb.from("companies").select("name, logo_url, engine, currency, prosumer_limit_kw, subsidy_amount_ron, lang, legal_name, reg_no, legal_address, iban, install_warranty_years, vat_rate").single(),
    sb.from("proposals").select("created_at").eq("project_id", params.id).limit(1).maybeSingle(),
    sb.from("products").select("*").order("created_at"),   // catalog for the bill of materials
    // the accepted + signed proposal, so the installer can view the signature back
    // (select("*") stays graceful before add-proposal-signature.sql has run).
    sb.from("proposals").select("*").eq("project_id", params.id)
      .not("accepted_at", "is", null).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
    // White-label template overrides (see add-custom-templates.sql): a
    // SEPARATE query, never merged into the main companies select above — a
    // database that hasn't run that migration yet must not error out (and
    // blank) every other real company field (name/logo/legal address/…)
    // this whole page depends on. An error here just means "no override".
    sb.from("companies").select("contract_template_override, commissioning_template_override").single(),
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
    .from("profiles").select("id, name, email, role, title").eq("company_id", p.company_id).order("created_at");

  // RBAC (lib/rbac.js, off by default — add-rbac.sql): a Sales title, once an
  // owner turns this on, opens only projects they own. The project row itself
  // already passed RLS (same company), so this is a visibility rule on TOP of
  // that, not instead of it.
  const user = await currentUser();
  const me = (team || []).find((m) => m.id === user?.id) || null;
  if (!canViewAllProjects(me, co?.rbac_enabled) && p.owner_id !== user?.id) {
    return (
      <div className="empty" style={{ maxWidth: 460, margin: "40px auto" }}>
        <b>{t("proj_not_yours", normLang(co?.lang))}</b>
        <Link className="fchip" style={{ marginTop: 8, display: "inline-block" }} href="/projects">{t("back_projects", normLang(co?.lang))}</Link>
      </div>
    );
  }
  const canEditTech = canEditTechnical(me, co?.rbac_enabled);

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
    level: signedProp.signature_level === "qualified" ? "qualified" : "simple",
    qualified: null,
  } : null;
  // a qualified signature's evidence: the provider's container, the hash of
  // what was signed, and whether it was the simulation (lib/qsignFlow.js)
  if (signed?.level === "qualified") {
    const { data: qs } = await sb.from("qualified_signatures").select("request_id, provider, document_hash, container, verification")
      .eq("proposal_code", signedProp.code).eq("status", "signed").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (qs) signed.qualified = { requestId: qs.request_id, documentHash: qs.document_hash, container: qs.container || "", simulated: qs.verification?.simulated !== false, issuer: qs.verification?.issuer || "" };
  }

  // the client's loan applications from this quote's offer (docs/FINANCING.md):
  // read on the installer's session; lender names from the server
  let loans = [];
  {
    const { data: la, error: laErr } = await sb.from("loan_applications").select("id, lender_id, status").eq("project_id", params.id).order("created_at", { ascending: false }).limit(3);
    if (!laErr && la?.length) {
      const { data: ln } = await supabaseAdmin().from("lenders").select("id, name").in("id", [...new Set(la.map((a) => a.lender_id))]);
      const nm = new Map((ln || []).map((l) => [l.id, l.name]));
      const lang = normLang(co?.lang);
      loans = la.map((a) => ({ id: a.id, status: a.status, text: lt("ln_on_quote", lang, { status: lt("st_" + a.status, lang), lender: nm.get(a.lender_id) || "" }) }));
    }
  }

  // the grid file sent to the operator (docs/INTEGRATIONS.md): the latest
  // submission with its history, and where each operator's package goes
  // (an address set in the environment, else the test mode that only records)
  let gridSub = { latest: null, events: [], needsDb: false, channels: { premier: process.env.GRID_EMAIL_PREMIER || "", rednord: process.env.GRID_EMAIL_REDNORD || "" } };
  if (p.market === "MD" || !p.market) {
    const { data: gs, error: gsErr } = await sb.from("grid_submissions").select("id, operator, channel, reference, status, checklist, note, created_at, updated_at").eq("project_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (gsErr && /grid_submissions|does not exist|schema cache/i.test(gsErr.message || "")) gridSub.needsDb = true;
    if (gs) {
      const { data: ev } = await sb.from("grid_submission_events").select("id, from_status, to_status, source, note, created_at").eq("submission_id", gs.id).order("created_at", { ascending: true }).limit(50);
      gridSub = { ...gridSub, latest: gs, events: ev || [] };
    }
  }

  return <Editor initial={p} engineSettings={E} team={team || []} catalog={catalog || []}
    canEditTechnical={canEditTech}
    prosumerLimitKw={Number(co?.prosumer_limit_kw ?? 10.8)} lang={normLang(co?.lang)} currency={co?.currency || "EUR"}
    proposalSentAt={prop?.created_at || null} companyName={co?.name || "VoltMira"} companyLogo={co?.logo_url || ""}
    companyLegal={{ legal_name: co?.legal_name || "", reg_no: co?.reg_no || "", legal_address: co?.legal_address || "", iban: co?.iban || "", install_warranty_years: co?.install_warranty_years || null,
      contract_template_override: wl?.contract_template_override || "", commissioning_template_override: wl?.commissioning_template_override || "" }}
    signed={signed} loans={loans} vatRatePct={Number(co?.vat_rate) || 0} cnedOn={cnedEnabled()} gridSub={gridSub} />;
}

