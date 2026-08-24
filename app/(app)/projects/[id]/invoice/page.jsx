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
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { currentCompany } from "../../../../../lib/session.js";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../../../lib/engineSettings.js";
import { getRate } from "../../../../../lib/fx.js";
import { rowToQuoteInput } from "../../../../../lib/quoteInput.js";
import { t, normLang } from "../../../../../lib/i18n.js";
import { fmtDate } from "../../../../../lib/tz.js";
import PrintNow from "./PrintNow.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice — VoltMira" };

export default async function InvoicePage({ params, searchParams }) {
  const sb = supabaseServer();
  const co = await currentCompany();
  const { data: p } = await sb.from("projects").select("*").eq("id", params.id).maybeSingle();
  if (!p || !co) notFound();

  const lang = normLang(co.lang);
  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";
  const cur = co.currency || "EUR";
  // CONVERT, don't just relabel. The engine works entirely in EUR ("All money in
  // EUR. Display conversion happens in the UI layer only." — engine.js) and
  // exports FX for this. Formatting a EUR figure with currency:"MDL" printed a
  // €23,375 system as "23.375 MDL" — roughly €1,180, a ~20x understatement on a
  // document a client can pay against. RON was the same bug at ~5x.
  // Live rate (ECB for RON, BNM for MDL), falling back to the engine constant
  // if either is unreachable. getRate never throws — an invoice must render.
  const fxInfo = await getRate(cur);
  const fx = Number(fxInfo.rate) > 0 ? Number(fxInfo.rate) : 1;
  const money = (n) => new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 })
    .format(Math.round((n || 0) * fx));

  const E = await companyEngine(co);
  const q = quote(rowToQuoteInput(p), E).e;
  const gross = Math.max(0, Math.round(q.cost || 0));

  // Prices shown to homeowners are VAT-inclusive, so back out the net + VAT.
  // A rate of 0 means NOT CONFIGURED (Settings shows it blank-as-zero), and
  // printing "VAT (0%)" on a document a client keeps asserts a zero rating that
  // is very likely false for a RO/MD installer. So below we show a single Total
  // instead of inventing a breakdown — and nudge, on screen only, to set it.
  const rate = Math.max(0, Number(co.vat_rate) || 0);
  const showVat = rate > 0;
  const net = showVat ? gross / (1 + rate / 100) : gross;
  const vat = gross - net;

  // Optional deposit: ?deposit=30 → a 30% deposit line + balance.
  const depPct = Math.min(100, Math.max(0, Number(searchParams?.deposit) || 0));
  const deposit = depPct > 0 ? Math.round(gross * depPct / 100) : 0;

  const today = new Date();
  const prefix = (co.invoice_prefix || "PF").toString().slice(0, 6);

  // A real running sequence (PF-2026-0001, -0002, …) instead of a slice of the
  // project's UUID. The number is drawn ONCE and then frozen on the project, so
  // reopening or re-printing the same invoice always shows the same number.
  // next_invoice_no() bumps companies.invoice_seq atomically, so two tabs can't
  // land on the same number. Skipped on router prefetch so merely hovering the
  // link can't burn a number. Falls back to the old id-derived string when the
  // migration hasn't been run yet, so nothing breaks in the meantime.
  let invNo = p.invoice_no || null;
  if (!invNo && headers().get("next-router-prefetch") !== "1") {
    const { data: seq } = await sb.rpc("next_invoice_no", { p_company: co.id });
    if (seq) {
      const candidate = `${prefix}-${today.getFullYear()}-${String(seq).padStart(4, "0")}`;
      const { error } = await sb.from("projects").update({ invoice_no: candidate }).eq("id", p.id);
      if (!error) invNo = candidate;   // couldn't persist ⇒ don't show a number we'd forget
    }
  }
  if (!invNo) invNo = `${prefix}-${today.getFullYear()}-${String(params.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`;
  const kw = Number(p.kw).toFixed(1);
  const lineDesc = t("inv_line", lang, { kw }) + (p.batt ? t("inv_line_batt", lang, { n: p.batt_kwh || 10 }) : "");
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
          .sidebar, .skip-link { display: none !important; }
          .app .main { margin: 0 !important; padding: 0 !important; }
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        .inv-actions { max-width: 820px; margin: 12px auto 0; padding: 0 40px; display: flex; gap: 10px; }
      `}</style>

      <div style={S.page}>
        {/* header */}
        <div style={{ ...S.row, alignItems: "flex-start", marginBottom: 34 }}>
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
          <div style={{ textAlign: "right" }}>
            <h1 style={S.h1}>{t("inv_title", lang)}</h1>
            <div style={{ ...S.muted, marginTop: 8 }}>
              {t("inv_no", lang)}: <b style={{ color: "#142A21" }}>{invNo}</b><br />
              {t("inv_date", lang)}: {fmtDate(today.toISOString(), locale, { day: "numeric", month: "short", year: "numeric" })}
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
            <th style={{ ...S.th, textAlign: "right", width: 90 }}>{t("inv_qty", lang)}</th>
            <th style={{ ...S.th, textAlign: "right", width: 150 }}>{t("inv_amount", lang)}</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style={S.td}><b>{p.title || t("inv_system", lang)}</b><div style={S.muted}>{lineDesc}</div></td>
              <td style={{ ...S.td, textAlign: "right" }}>1</td>
              <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{money(net)}</td>
            </tr>
          </tbody>
        </table>

        {/* totals */}
        <div style={{ ...S.row, justifyContent: "flex-end" }}>
          <div style={{ width: 300 }}>
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
                  <span style={S.muted}>{t("inv_balance", lang)}</span><span>{money(gross - deposit)}</span>
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
          {t("inv_proforma_note", lang)}
          {/* Disclose the conversion. Quoting is done in EUR, so a client
              holding an MDL/RON total cannot reconcile it against the proposal
              without the rate — and an undisclosed rate is exactly the kind of
              thing this product exists to not do. */}
          {fx !== 1 && (
            <div style={{ marginTop: 6 }}>
              {t("inv_fx_note", lang, { r: fx.toFixed(4), c: cur })}
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
        {searchParams?.pdf !== "1" && <PrintNow />}
    </div>
  );
}
