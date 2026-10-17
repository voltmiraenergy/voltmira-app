// lib/loanDocument.js — the loan application as the lender receives it: an
// email body that is also the PDF (lib/lenderAdapters.js email adapter). In
// the lender's language (Romanian by default, from lib/loanText.js), every
// value escaped. Pure.
import { escapeHtml } from "./safe.js";
import { lt } from "./loanText.js";

const money = (minor, currency, lang) => new Intl.NumberFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { maximumFractionDigits: 0 }).format(Math.round(minor / 100)) + (currency === "MDL" ? " lei" : ` ${currency}`);

/**
 * @param {object} a
 * @param {object} a.app      the loan_applications row
 * @param {object} a.lender   { name }
 * @param {object} a.offer    the financing_offers row
 * @param {object} a.company  { name, legal_name }
 * @param {object} [a.project] { title, kw }
 * @param {string} [a.lang]
 * @returns {{ subject, html, filename }}
 */
export function loanApplicationDocument({ app, lender, offer, company, project = {}, lang = "ro" }) {
  const e = (s) => escapeHtml(String(s ?? ""));
  const a = app.applicant || {};
  const rows = [
    ["doc_applicant", a.name], ["doc_phone", a.phone], ["doc_email", a.email], ["doc_locality", a.locality],
    ["doc_product", offer?.product_name?.[lang] || offer?.product_name?.en || ""],
    ["doc_amount", money(app.amount_minor, app.currency, lang)],
    ["doc_term", lt("months_n", lang, { n: app.term_months })],
    ["doc_rate", `${(app.rate_bps / 100).toFixed(2)}%`],
    ["doc_monthly", money(app.monthly_minor, app.currency, lang)],
    ...(app.support_minor > 0 ? [["doc_support", money(app.support_minor, app.currency, lang)]] : []),
    ["doc_installer", company?.legal_name || company?.name],
    ["doc_system", project?.kw ? `${project.kw} kW, ${project.title || ""}` : project?.title || ""],
    ["doc_consent", lt("doc_consent_v", lang, { at: String(app.consent_at || "").replace("T", " ").slice(0, 16), v: app.consent_version })],
    ["doc_ref", app.id],
  ].filter(([, v]) => v != null && v !== "");
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${e(lt("doc_title", lang))}</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#142A21;margin:32px;font-size:13px}h1{font-size:19px;margin:0 0 4px}p{color:#5D6B62;margin:0 0 18px}
table{border-collapse:collapse;width:100%}td{padding:8px 10px;border-bottom:1px solid #E3E1D6;vertical-align:top}td:first-child{color:#5D6B62;width:38%}</style></head>
<body><h1>${e(lt("doc_title", lang))}</h1><p>${e(lt("doc_sub", lang, { lender: lender?.name || "" }))}</p>
<table>${rows.map(([k, v]) => `<tr><td>${e(lt(k, lang))}</td><td>${e(v)}</td></tr>`).join("")}</table>
<p style="margin-top:18px">${e(lt("doc_foot", lang))}</p></body></html>`;
  return {
    subject: lt("doc_subject", lang, { name: a.name || "", amount: money(app.amount_minor, app.currency, lang) }),
    html,
    filename: `cerere-credit-${String(app.id).slice(0, 8)}.pdf`,
  };
}
