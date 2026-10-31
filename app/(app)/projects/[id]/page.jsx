// Server wrapper: fetch project + engine settings, hand to client editor.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../../lib/supabase.js";
import { companyEngine } from "../../../../lib/engineSettings.js";
import { t, normLang } from "../../../../lib/i18n.js";
import { currentUser } from "../../../../lib/session.js";
import { canViewAllProjects, canEditTechnical, canOverrideGrid } from "../../../../lib/rbac.js";
import { allGridRules } from "../../../../lib/gridRulesStore.js";
import { jobGate, loadJobFee, feePreview } from "../../../../lib/jobFeeServer.js";
import { feePaywallOn } from "../../../../lib/jobFees.js";
import { isDemoEmail } from "../../../../lib/demo.js";
import { mdDayKey } from "../../../../lib/tz.js";

// today on the Chișinău clock, read once per request (the grid card counts days in a step from it)
const todayKey = () => mdDayKey(Date.now());
import Editor from "./editor.jsx";
import { cnedEnabled } from "../../../../lib/cnedData.js";
import { appTitle } from "../../../../lib/pageTitle.js";
import { lt } from "../../../../lib/loanText.js";
import { productionPower } from "../../../../lib/gridPower.js";
import { quote } from "@voltmira/engine";
import { snapshotEngine } from "../../../../lib/engineSettings.js";
import { offerQuoteInput } from "../../../../lib/offerInput.js";
import { effectiveOfferCurrency } from "../../../../lib/offerCurrency.js";
import { moneyFormatter } from "../../../../lib/money.js";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("col_project");

export default async function ProjectPage(props) {
  const params = await props.params;
  const sb = await supabaseServer();
  // The project fetch is RLS-scoped to the caller's company (projects_all uses
  // the security-definer my_company_id(), no recursion).
  const [{ data: p }, { data: co }, { data: prop }, { data: catalog }, { data: signedProp }, { data: wl }, { data: rb }] = await Promise.all([
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
    // the access-control switch, on its own: it was never loaded here, so a Sales user could open a
    // colleague's quote by its address even when the owner had turned access control on. A missing
    // column is "off", as everywhere else.
    sb.from("companies").select("rbac_enabled").single(),
  ]);
  const rbacOn = !!rb?.rbac_enabled;
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
  if (!canViewAllProjects(me, rbacOn) && p.owner_id !== user?.id) {
    return (
      <div className="empty" style={{ maxWidth: 460, margin: "40px auto" }}>
        <b>{t("proj_not_yours", normLang(co?.lang))}</b>
        <Link className="fchip" style={{ marginTop: 8, display: "inline-block" }} href="/projects">{t("back_projects", normLang(co?.lang))}</Link>
      </div>
    );
  }
  const canEditTech = canEditTechnical(me, rbacOn);

  // Live FX comes in via companyEngine so the editor's grant maths matches the
  // dashboard's. The editor is a client component, so the rate has to arrive as
  // a prop — it cannot fetch it itself.
  const E = await companyEngine(co);
  const signed = signedProp ? {
    signature: signedProp.signature || null,
    signerName: signedProp.signer_name || null,
    acceptedAt: signedProp.accepted_at || null,
    signedIp: signedProp.signed_ip || null,
    signedUa: signedProp.signed_ua || null,
    level: signedProp.signature_level === "qualified" ? "qualified" : "simple",
    qualified: null,
  } : null;
  // What the client signed, for the contract: the offer's frozen figures, at the rate and prices it was
  // issued with. The contract used today's rate and today's price, so it could differ from the offer
  // the client put their name to.
  let signedOffer = null;
  if (signedProp?.snapshot && typeof signedProp.snapshot === "object") {
    try {
      const snap = signedProp.snapshot;
      const Es = snapshotEngine(snap.engine, co);
      const qq = quote(offerQuoteInput(snap), Es);
      const f = moneyFormatter({ currency: effectiveOfferCurrency(snap.offerCurrency, co?.currency, snap.market), lang: normLang(co?.lang), fx: Es?.fx });
      signedOffer = {
        price: f.toLocal(qq.e.cost), currency: f.currency,
        kw: Number(snap.kw) || null, batt: !!snap.batt, battKwh: snap.battKwh != null ? Number(snap.battKwh) : null,
        bom: Array.isArray(snap.bom) ? snap.bom : null, clientName: snap.client || null, address: snap.address || null,
      };
    } catch (e) { console.error("[contract] signed offer not rebuilt:", e?.message); }
  }
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
  // with what each operator asks for (lib/gridRules.js), who may send past the checklist with a reason, and the
  // language the client's messages go out in
  let gridSub = { latest: null, events: [], needsDb: false, installedKw: productionPower(p).kw, ceilingKw: Number(co?.prosumer_limit_kw) > 0 ? Number(co.prosumer_limit_kw) : null, channels: { premier: process.env.GRID_EMAIL_PREMIER || "", rednord: process.env.GRID_EMAIL_REDNORD || "" },
    rules: null, canOverride: canOverrideGrid(me), clientLang: p.client_lang ?? undefined, companyName: co?.short_name || co?.name || "", today: todayKey() };
  if (p.market === "MD" || !p.market) {
    gridSub.rules = await allGridRules();
    const cols = "id, operator, channel, reference, status, checklist, note, created_at, updated_at";
    let { data: gs, error: gsErr } = await sb.from("grid_submissions").select(cols + ", overrides, doc_dates").eq("project_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    // before add-grid-connection.sql: the same row without the newer columns
    if (gsErr && /overrides|doc_dates|column/i.test(gsErr.message || "")) ({ data: gs, error: gsErr } = await sb.from("grid_submissions").select(cols).eq("project_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (gsErr && /grid_submissions|does not exist|schema cache/i.test(gsErr.message || "")) gridSub.needsDb = true;
    if (gs) {
      const { data: ev } = await sb.from("grid_submission_events").select("id, from_status, to_status, source, note, created_at").eq("submission_id", gs.id).order("created_at", { ascending: true }).limit(50);
      gridSub = { ...gridSub, latest: gs, events: ev || [] };
    }
  }

  // VoltMira's fee for signed jobs (lib/jobFees.js): on a signed job its fee, the statement it is on and whether its
  // paperwork is locked; on a job the client gave up, that nothing is owed; before signing, what it will cost. The
  // tax id is read on its own, so a database without add-job-fees.sql still opens the quote.
  let jobFee = null;
  {
    const { data: idRow } = await sb.from("companies").select("idno").single();
    const admin = supabaseAdmin();
    const coFee = { ...co, idno: idRow?.idno || null };
    const sample = p.is_sample === true || isDemoEmail(user?.email);
    if (p.status === "won") {
      const gate = await jobGate(admin, { project: p, co: coFee, user });
      const fee = gate.fee || (await loadJobFee(admin, p.id)).fee;
      let statement = null;
      if (fee?.invoice_id) {
        const { data: inv } = await admin.from("job_fee_invoices").select("id, number, month, due_at, paid_at").eq("id", fee.invoice_id).maybeSingle();
        statement = inv || null;
      }
      if (fee || gate.error) {
        jobFee = {
          fee: fee ? { id: fee.id, status: fee.status, tier: fee.tier, kw: Number(fee.kw) || 0, amount_minor: fee.amount_minor, won_at: fee.won_at, trigger: fee.trigger, free_slot: fee.free_slot, paid_at: fee.paid_at, payment_method: fee.payment_method, docs_at: fee.docs_at || null, waiver_requested_at: fee.waiver_requested_at || null } : null,
          statement, locked: gate.locked, error: gate.error || null, on: feePaywallOn(), sample, beta: gate.access?.reason === "beta",
        };
      }
    } else if (p.status === "lost") {
      const { fee } = await loadJobFee(admin, p.id);
      if (fee) jobFee = { fee: { id: fee.id, status: fee.status, docs_at: fee.docs_at || null, waiver_requested_at: fee.waiver_requested_at || null }, on: feePaywallOn(), sample };
    } else {
      jobFee = { preview: await feePreview(admin, p, coFee), on: feePaywallOn(), sample };
    }
  }
  const sp = await props.searchParams;
  const feeOpen = ["locked", "idno", "sign", "retry", "kw"].includes(sp?.fee) ? sp.fee : null;

  return <Editor initial={p} engineSettings={E} jobFee={jobFee} feeOpen={feeOpen} meName={me?.name || user?.email || ""} team={team || []} catalog={catalog || []}
    canEditTechnical={canEditTech}
    prosumerLimitKw={Number(co?.prosumer_limit_kw ?? 10.8)} lang={normLang(co?.lang)} currency={co?.currency || "EUR"}
    proposalSentAt={prop?.created_at || null} companyName={co?.name || "VoltMira"} companyLogo={co?.logo_url || ""}
    companyLegal={{ legal_name: co?.legal_name || "", reg_no: co?.reg_no || "", legal_address: co?.legal_address || "", iban: co?.iban || "", install_warranty_years: co?.install_warranty_years || null,
      contract_template_override: wl?.contract_template_override || "", commissioning_template_override: wl?.commissioning_template_override || "" }}
    signed={signed} signedOffer={signedOffer} loans={loans} vatRatePct={Number(co?.vat_rate) || 0} cnedOn={cnedEnabled()} gridSub={gridSub} />;
}

