// app/l/[token]/page.jsx — a partner lender's portal (docs/FINANCING.md): the
// applications sent to it, newest first, and a status control on each. The
// link is the lender's secret: only its SHA-256 is stored (lenders.
// portal_token_hash), and it opens only that lender's applications. Never
// indexed; Romanian unless ?lang= says otherwise.
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { hashToken } from "../../../lib/lenderSignature.js";
import { allowedNext, isFinal } from "../../../lib/loanStatus.js";
import { lt } from "../../../lib/loanText.js";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import PortalRow from "./PortalRow.jsx";
import "../../p/[code]/proposal.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "VoltMira", robots: { index: false, follow: false, nocache: true } };

const LANGS = ["ro", "ru", "en", "uk"];

export default async function LenderPortal(props) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const lang = LANGS.includes(sp?.lang) ? sp.lang : "ro";
  if (String(token || "").length < 20) notFound();
  const db = supabaseAdmin();
  const { data: lender } = await db.from("lenders").select("id, name, active").eq("portal_token_hash", hashToken(token)).maybeSingle();
  if (!lender || lender.active === false) notFound();
  const { data: apps } = await db.from("loan_applications")
    .select("id, company_id, applicant, amount_minor, currency, term_months, rate_bps, monthly_minor, status, lender_ref, created_at")
    .eq("lender_id", lender.id).order("created_at", { ascending: false }).limit(200);
  const ids = [...new Set((apps || []).map((a) => a.company_id))];
  const { data: cos } = ids.length ? await db.from("companies").select("id, name, legal_name").in("id", ids) : { data: [] };
  const coName = new Map((cos || []).map((c) => [c.id, c.legal_name || c.name]));
  const money = (minor, cur) => new Intl.NumberFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang], { maximumFractionDigits: 0 }).format(Math.round(minor / 100)) + (cur === "MDL" ? " lei" : ` ${cur}`);
  const when = (d) => new Intl.DateTimeFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang], { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
  const labels = Object.fromEntries(["submitted", "in_review", "approved", "rejected", "funded", "failed"].map((s) => [s, lt("st_" + s, lang)]));

  return (
    <main className="pp" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap lp">
        <header className="lp-head">
          <h1 className="pp-h2">{lt("lp_title", lang, { lender: lender.name })}</h1>
          <p className="pp-lead">{lt("lp_sub", lang)}</p>
          <nav className="lp-langs" aria-label="Language">{LANGS.map((l) => <a key={l} href={`?lang=${l}`} aria-current={l === lang ? "true" : undefined}>{l.toUpperCase()}</a>)}</nav>
        </header>
        {!apps?.length ? <p className="pp-lead">{lt("lp_none", lang)}</p> : (
          <ul className="lp-list">
            {apps.map((a) => (
              <li key={a.id} className="pp-card lp-item">
                <div className="lp-top">
                  <b>{a.applicant?.name}</b>
                  <span className={"lp-st s-" + a.status}>{labels[a.status]}</span>
                </div>
                <dl className="lp-facts">
                  <div><dt>{lt("doc_amount", lang)}</dt><dd>{money(a.amount_minor, a.currency)}</dd></div>
                  <div><dt>{lt("doc_term", lang)}</dt><dd>{lt("months_n", lang, { n: a.term_months })}</dd></div>
                  <div><dt>{lt("doc_monthly", lang)}</dt><dd>{money(a.monthly_minor, a.currency)}</dd></div>
                  <div><dt>{lt("doc_phone", lang)}</dt><dd><a href={`tel:${a.applicant?.phone || ""}`}>{a.applicant?.phone}</a></dd></div>
                  {a.applicant?.email && <div><dt>{lt("doc_email", lang)}</dt><dd>{a.applicant.email}</dd></div>}
                  {a.applicant?.locality && <div><dt>{lt("doc_locality", lang)}</dt><dd>{a.applicant.locality}</dd></div>}
                  <div><dt>{lt("doc_installer", lang)}</dt><dd>{coName.get(a.company_id) || ""}</dd></div>
                  <div><dt>{lt("doc_ref", lang)}</dt><dd><code>{a.lender_ref || a.id.slice(0, 8)}</code>, {when(a.created_at)}</dd></div>
                </dl>
                {isFinal(a.status) ? <p className="lp-final">{lt("lp_final", lang)}</p> : (
                  <PortalRow token={token} applicationId={a.id} next={allowedNext(a.status).filter((s) => s !== "failed")} labels={labels} lang={lang}
                    t={{ set: lt("lp_set", lang), ref: lt("lp_ref", lang), note: lt("lp_note", lang), save: lt("lp_save", lang), saved: lt("lp_saved", lang), bad: lt("lp_bad", lang), failed: lt("lp_failed", lang) }} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
