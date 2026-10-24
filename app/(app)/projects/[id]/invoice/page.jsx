// app/(app)/projects/[id]/invoice/page.jsx — a proforma / deposit invoice PDF.
//
// Auth-scoped (under the (app) layout; the project read is RLS-scoped to the
// caller's company). Renders an A4-styled invoice from the installer's company
// legal details + the project's quote, then auto-opens the save-as-PDF dialog.
// The app sidebar is hidden in print so the PDF is just the document.
//
// Honesty note printed on it: this is a PROFORMA, not a fiscal invoice — in
// Romania a fiscal invoice must be issued through ANAF e-Factura. It's the right
// document to request a deposit / bank transfer against.
import { notFound, redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "../../../../../lib/supabase.js";
import { jobGate } from "../../../../../lib/jobFeeServer.js";
import { currentCompany, currentUser } from "../../../../../lib/session.js";
import { projectVisibility } from "../../../../../lib/projectAccess.js";
import { projectInvoice } from "../../../../../lib/invoiceServer.js";
import { t, normLang } from "../../../../../lib/i18n.js";
import { fmtDate } from "../../../../../lib/tz.js";
import PrintNow from "./PrintNow.jsx";
import IssueInvoice from "./IssueInvoice.jsx";
import BackLink from "../../../../../components/BackLink.jsx";
import { appTitle } from "../../../../../lib/pageTitle.js";
import { xt } from "../../../../../lib/integrationText.js";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("inv_button");

export default async function InvoicePage(props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const sb = await supabaseServer();
  const co = await currentCompany();
  const { data: p } = await sb.from("projects").select("*").eq("id", params.id).maybeSingle();
  if (!p || !co) notFound();
  // access control: a Sales member does not open a colleague's proforma by its address
  const u = await currentUser();
  if (!u || !(await projectVisibility(u, co))(p)) notFound();
  // a won job's paperwork waits on its fee once the 14 days to pay are over (lib/jobFees.js)
  const gate = await jobGate(supabaseAdmin(), { project: p, co, user: u });
  if (gate.locked) redirect(`/projects/${p.id}?fee=${gate.error === "needs_idno" ? "idno" : "locked"}`);

  const lang = normLang(co.lang);
  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB";
  // Every figure comes from projectInvoice (lib/invoiceServer.js). Once the invoice is issued these are the figures
  // written with its number (the amounts, the currency, the rate and where it came from), so this page, the PDF,
  // the exports and e-Factura print the same amount on any day. Before that it is a draft, worked out from the
  // quote, the live rate (ECB for RON, BNM for MDL, NBU for UAH) and the workspace's settings, in the QUOTE's
  // currency (lib/offerCurrency.js): the offer's own when the installer chose one, else the workspace's.
  // CONVERT, don't just relabel: the engine works in EUR, and formatting a EUR figure as MDL once printed a
  // 23,375 EUR system as "23.375 MDL". Optional deposit on a draft: ?deposit=30 -> a 30% deposit line + balance.
  const inv = await projectInvoice(p, co, { depositPct: searchParams?.deposit });
  const { cur, fx, fxInfo } = inv;
  // Prices shown to homeowners are VAT-inclusive, so the net + VAT are backed out of the total. A rate of 0 means
  // NOT CONFIGURED (Settings shows it blank-as-zero), and printing "VAT (0%)" on a document a client keeps asserts
  // a zero rating that is very likely false for a RO/MD installer, so below a single Total is shown instead of an
  // invented breakdown (and, on screen only, a nudge to set it). Every printed line adds up to the printed total.
  const { gross, net, vat, rate, showVat, depositPct: depPct, deposit, balance } = inv.amounts;
  // Every amount is ALREADY in `cur`, so this only formats it.
  const money = (n) => new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 })
    .format(Math.round(n || 0));

  // The number is drawn when the installer issues the invoice (IssueInvoice, lib/invoiceIssue.js), never by opening
  // this page or its PDF: a draft prints no number, and the day on it is today until it is issued.
  const issued = !!p.invoice_no;
  const invNo = p.invoice_no || t("inv_draft", lang);
  const docDate = issued && p.invoiced_at ? new Date(p.invoiced_at) : new Date();
  // the invoice's e-Factura status (billing page, docs/INTEGRATIONS.md): once
  // SFS has accepted it, its fiscal number prints on the proforma
  const { data: ef } = await sb.from("efactura_submissions").select("status, fiscal_number, provider").eq("project_id", p.id).order("attempt", { ascending: false }).limit(1).maybeSingle();
  // Decimals the way the client writes them ("6,0 kW" in Romanian), like the
  // amounts below: toFixed() printed "6.0" on a Romanian invoice.
  const dec = (n, d) => Number(n).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  const kw = dec(inv.line.kw, 1);
  const lineDesc = t("inv_line", lang, { kw }) + (inv.line.battKwh ? t("inv_line_batt", lang, { n: Number(inv.line.battKwh).toLocaleString(locale, { maximumFractionDigits: 1 }) }) : "");
  const legalName = co.legal_name || co.name || "—";

  const S = {
    page: { maxWidth: 820, margin: "0 auto", padding: "32px 40px", color: "#142A21", fontFamily: "Inter, system-ui, sans-serif", background: "#fff" },
    row: { display: "flex", justifyContent: "space-between", gap: 24 },
    muted: { color: "#66756C", fontSize: 13, lineHeight: 1.6 },
    h1: { fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", margin: 0 },
    label: { fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#66756C", marginBottom: 6 },
    th: { textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#66756C", padding: "0 0 10px", borderBottom: "2px solid #142A21" },
    td: { padding: "14px 0", borderBottom: "1px solid #E3E1D6", fontSize: 14, verticalAlign: "top" },
    tot: { display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 14 },
  };

  return (
    <div className="invoice-doc">
      <style>{`
        @media print {
          .sidebar, .skip-link, .demo-bar, .offline-bar { display: none !important; }
          /* the app shell is a 236px + 1fr grid: with the sidebar hidden the
             invoice would fall into the narrow first column */
          .app { display: block !important; }
          html, body, .app, .app .main { background: #fff !important; }
          .app .main { margin: 0 !important; padding: 0 !important; width: auto !important; max-width: none !important; }
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        .inv-issue { max-width: 820px; margin: 12px auto 14px; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; background: #FBF0DD; color: #142A21; border-radius: 12px; }
        .inv-issue p { margin: 0; font-size: 13.5px; line-height: 1.5; max-width: 560px; }
        .inv-actions { max-width: 820px; margin: 12px auto 0; padding: 0 40px; display: flex; gap: 10px; }
        .inv-back-row { max-width: 820px; margin: 0 auto; padding: 16px 40px 0; }
        @media screen and (max-width: 640px) {
          .inv-page { padding: 22px 16px !important; }
          .inv-head { flex-direction: column; gap: 14px !important; margin-bottom: 24px !important; }
          .inv-head-r { text-align: left !important; }
          .inv-head-r h1 { font-size: 24px !important; }
          .inv-qty { width: 44px !important; }
          .inv-amt { width: auto !important; }
          .inv-page th:not(:first-child), .inv-page td:not(:first-child) { padding-left: 12px !important; }
          .inv-totals { width: 100% !important; }
          .inv-back-row, .inv-actions { padding-left: 16px; padding-right: 16px; }
          .inv-actions { flex-wrap: wrap; }
        }
      `}</style>

      {/* Reached only via a link from the project editor, with no route of its
          own reachable from the sidebar/bottom-tab bar — in the standalone
          Home Screen app there's no Safari swipe-back to fall back on, so
          without this the page was a dead end. */}
      <div className="inv-back-row no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <BackLink href={`/projects/${params.id}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
          {t("back_quote", lang)}
        </BackLink>
        <Link href={`/projects/${params.id}/billing`} className="btn ghost sm">
          {xt("bl_link", lang)}{ef?.status ? `: ${ef.status === "accepted" ? (ef.fiscal_number || "") : xt("ef_st_" + ef.status, lang, { n: "", reason: "" }).replace(/[:,]\s*$/, "")}` : ""}
        </Link>
      </div>

      {/* On screen only. A draft has no number; issuing draws the next one and fixes the amounts shown. */}
      <div className="inv-issue no-print">
        {issued
          ? <p>{t("inv_issued_note", lang, { d: fmtDate(docDate.toISOString(), locale, { day: "numeric", month: "long", year: "numeric" }) })}</p>
          : <>
              <p>{t("inv_issue_note", lang)}</p>
              <IssueInvoice projectId={params.id} deposit={depPct} lang={lang} />
            </>}
      </div>

      <div className="inv-page" style={S.page}>
        {/* header */}
        <div className="inv-head" style={{ ...S.row, alignItems: "flex-start", marginBottom: 34 }}>
          <div>
            {/* With a logo: logo on top, company name under it. WITHOUT a logo the
                name stands in for the logo — print it once, larger, not twice
                (it used to render as both the logo substitute AND the name line,
                so every installer with no logo mailed clients a doubled header). */}
            {co.logo_url && /^(https?:|data:image\/)/.test(co.logo_url)
              ? <img src={co.logo_url} alt="" style={{ height: 40, marginBottom: 12, objectFit: "contain" }} />
              : null}
            <div style={co.logo_url && /^(https?:|data:image\/)/.test(co.logo_url)
              ? { fontWeight: 700, fontSize: 15 }
              : { fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{legalName}</div>
            <div style={S.muted}>
              {co.reg_no ? <>{t("inv_regno", lang)}: {co.reg_no}<br /></> : null}
              {co.vat_no ? <>{t("inv_vatno", lang)}: {co.vat_no}<br /></> : null}
              {co.legal_address || ""}
            </div>
          </div>
          <div className="inv-head-r" style={{ textAlign: "right" }}>
            <h1 style={S.h1}>{t("inv_title", lang)}</h1>
            <div style={{ ...S.muted, marginTop: 8 }}>
              {t("inv_no", lang)}: <b style={{ color: "#142A21" }}>{invNo}</b><br />
              {t("inv_date", lang)}: {fmtDate(docDate.toISOString(), locale, { day: "numeric", month: "short", year: "numeric" })}
              {ef?.status === "accepted" && ef.fiscal_number && ef.provider === "sfs" && <><br />{t("inv_efactura_no", lang)}: <b style={{ color: "#142A21" }}>{ef.fiscal_number}</b></>}
            </div>
          </div>
        </div>

        {/* bill to */}
        <div style={{ marginBottom: 30 }}>
          <div style={S.label}>{t("inv_billto", lang)}</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{p.client_name || p.title || "—"}</div>
          <div style={S.muted}>{p.address || ""}</div>
        </div>

        {/* line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 22 }}>
          <thead><tr>
            <th style={S.th}>{t("inv_desc", lang)}</th>
            <th className="inv-qty" style={{ ...S.th, textAlign: "right", width: 90 }}>{t("inv_qty", lang)}</th>
            <th className="inv-amt" style={{ ...S.th, textAlign: "right", width: 150 }}>{t("inv_amount", lang)}</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style={S.td}><b>{inv.line.title || t("inv_system", lang)}</b><div style={S.muted}>{lineDesc}</div></td>
              <td style={{ ...S.td, textAlign: "right" }}>1</td>
              <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{money(net)}</td>
            </tr>
          </tbody>
        </table>

        {/* totals */}
        <div style={{ ...S.row, justifyContent: "flex-end" }}>
          <div className="inv-totals" style={{ width: 300 }}>
            {showVat && (
              <>
                <div style={S.tot}><span style={S.muted}>{t("inv_subtotal", lang)}</span><span>{money(net)}</span></div>
                <div style={S.tot}><span style={S.muted}>{t("inv_vat", lang)} ({rate}%)</span><span>{money(vat)}</span></div>
              </>
            )}
            <div style={{ ...S.tot, borderTop: "2px solid #142A21", marginTop: 4, paddingTop: 12, fontWeight: 800, fontSize: 18 }}>
              <span>{t("inv_total", lang)}</span><span>{money(gross)}</span>
            </div>
            {/* On screen for the installer only — never printed for the client. */}
            {!showVat && (
              <div className="no-print" style={{ ...S.muted, fontSize: 11.5, marginTop: 10 }}>
                {t("inv_vat_unset", lang)}
              </div>
            )}
            {deposit > 0 && (
              <>
                <div style={{ ...S.tot, marginTop: 8, padding: "12px 14px", background: "#FBF0DD", borderRadius: 10, fontWeight: 700 }}>
                  <span>{t("inv_deposit", lang, { p: depPct })}</span><span>{money(deposit)}</span>
                </div>
                {/* State the remainder explicitly. A deposit line on its own
                    leaves the client working out what is still owed. */}
                <div style={{ ...S.tot, fontSize: 13 }}>
                  <span style={S.muted}>{t("inv_balance", lang)}</span><span>{money(balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* payment */}
        {co.iban && (
          <div style={{ marginTop: 34, padding: "16px 18px", border: "1px solid #E3E1D6", borderRadius: 12 }}>
            <div style={S.label}>{t("inv_pay", lang)}</div>
            <div style={{ fontSize: 14 }}>{t("inv_iban", lang)}: <b>{co.iban}</b></div>
            <div style={S.muted}>{t("inv_ref", lang)}: {invNo}</div>
          </div>
        )}

        {/* honesty footer */}
        <div style={{ ...S.muted, marginTop: 34, paddingTop: 16, borderTop: "1px solid #E3E1D6", fontSize: 11.5 }}>
          {t("inv_proforma_note", lang)}{" "}
          {t("inv_fiscal_" + (["MD", "RO", "UA"].includes(p.market) ? p.market : "MD"), lang)}
          {/* Disclose the conversion. Quoting is done in EUR, so a client
              holding an MDL/RON total cannot reconcile it against the proposal
              without the rate — and an undisclosed rate is exactly the kind of
              thing this product exists to not do. */}
          {fx !== 1 && (
            <div style={{ marginTop: 6 }}>
              {t("inv_fx_note", lang, { r: dec(fx, 4), c: cur })}
              {/* Name the source and the day. A rate without provenance is just
                  another number the client has to take on trust. */}
              {fxInfo.live && fxInfo.source
                ? " " + t("inv_fx_src", lang, { s: fxInfo.source, d: fxInfo.asOf || "" })
                : " " + t("inv_fx_static", lang)}
            </div>
          )}
        </div>
      </div>

      {/* The PDF route drives printing via CDP and passes pdf=1; window.print()
            inside headless Chromium blocks rather than returning. */}
      {issued && searchParams?.pdf !== "1" && <PrintNow />}
    </div>
  );
}
