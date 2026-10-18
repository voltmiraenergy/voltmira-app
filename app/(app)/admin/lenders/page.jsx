// app/(app)/admin/lenders/page.jsx — partner lenders, their portal links and
// webhook set-up, applications that did not reach their lender, and the
// commission each lender owes VoltMira per month (docs/FINANCING.md).
// Platform admins only; anyone else gets a 404.
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { normLang } from "../../../../lib/i18n.js";
import { lt } from "../../../../lib/loanText.js";
import { secretEnvName } from "../../../../lib/lenderSignature.js";
import { payoutReport } from "../../../../lib/commission.js";
import { missingTable } from "../../../../lib/loanFlow.js";
import AdminNav, { ADMIN_CSS } from "../AdminNav.jsx";
import LenderActions from "./LenderActions.jsx";

export const dynamic = "force-dynamic";

export default async function LendersPage() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  const db = supabaseAdmin();
  const [{ data: lenders, error }, { data: ledger }, { data: failed }] = await Promise.all([
    db.from("lenders").select("id, code, name, adapter, contact_email, commission_type, commission_bps, commission_flat_minor, currency, is_sample, active, portal_token_hash").order("name"),
    db.from("commission_ledger").select("lender_id, period, currency, loan_minor, amount_minor"),
    db.from("loan_applications").select("id, lender_id, applicant, amount_minor, currency, created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(50),
  ]);
  const needsDb = missingTable(error);
  const nf = new Intl.NumberFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { maximumFractionDigits: 0 });
  const money = (minor, cur) => `${nf.format(Math.round((minor || 0) / 100))} ${cur === "MDL" ? "lei" : cur}`;
  const report = payoutReport(ledger || [], lenders || []);
  const names = new Map((lenders || []).map((l) => [l.id, l.name]));

  return (
    <div className="dx adm">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="dx-head"><div className="dx-hello"><h1>{lt("al_title", lang)}</h1><p className="dx-summary">{lt("al_sub", lang)}</p></div></header>
      <AdminNav lang={lang} here="/admin/lenders" />
      {needsDb ? <p className="adm-warn" role="note">{lt("al_needs_db", lang)}</p> : (
        <>
          <section className="adm-card">
            <h2>{lt("al_lenders", lang)}</h2>
            <div className="adm-scroll">
              <table className="adm-table">
                <thead><tr><th>{lt("al_lender", lang)}</th><th>{lt("al_channel", lang)}</th><th>{lt("al_terms", lang)}</th><th>Webhook</th><th /></tr></thead>
                <tbody>
                  {(lenders || []).map((l) => (
                    <tr key={l.id}>
                      <td><b>{l.name}</b>{l.is_sample ? ` (${lt("al_sample", lang)})` : ""}<br /><small><code>{l.code}</code></small></td>
                      <td>{l.adapter}{l.adapter === "email" ? <><br /><small>{l.contact_email || "?"}</small></> : null}</td>
                      <td className="num">{l.commission_type === "flat" ? money(l.commission_flat_minor, l.currency) : `${(l.commission_bps / 100).toFixed(2)}%`}</td>
                      <td><small>{lt("al_webhook", lang, { path: `/api/lenders/webhook/${l.code}`, env: secretEnvName(l.code) })}</small><br />
                        <small>{process.env[secretEnvName(l.code)] ? lt("al_secret_set", lang) : lt("al_secret_missing", lang)}</small></td>
                      <td><LenderActions mode="portal" id={l.id} label={lt("al_portal", lang)} once={lt("al_portal_once", lang)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {failed?.length > 0 && (
            <section className="adm-card">
              <h2>{lt("st_failed", lang)}</h2>
              <table className="adm-table">
                <tbody>
                  {failed.map((a) => (
                    <tr key={a.id}>
                      <td>{a.applicant?.name}</td><td>{names.get(a.lender_id)}</td><td className="num">{money(a.amount_minor, a.currency)}</td>
                      <td><LenderActions mode="resend" id={a.id} label={lt("al_resend", lang)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="adm-card">
            <h2>{lt("al_report", lang)}</h2>
            {report.length ? (
              <>
                <div className="adm-scroll">
                  <table className="adm-table">
                    <thead><tr><th>{lt("al_period", lang)}</th><th>{lt("al_lender", lang)}</th><th>{lt("al_loans", lang)}</th><th>{lt("al_volume", lang)}</th><th>{lt("al_owed", lang)}</th></tr></thead>
                    <tbody>{report.map((r) => <tr key={`${r.lenderId}${r.period}${r.currency}`}><td className="num">{r.period}</td><td>{r.lender}</td><td className="num">{r.loans}</td><td className="num">{money(r.loanMinor, r.currency)}</td><td className="num"><b>{money(r.amountMinor, r.currency)}</b></td></tr>)}</tbody>
                  </table>
                </div>
                <div className="adm-actions"><a className="btn ghost" href="/api/admin/lenders?format=csv">{lt("al_csv", lang)}</a></div>
              </>
            ) : <p>{lt("al_none", lang)}</p>}
          </section>
        </>
      )}
    </div>
  );
}
