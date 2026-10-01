// app/(app)/portfolios/page.jsx — the list of portfolios: quotes grouped as one
// investment for a lender or fund (lib/portfolio.js). Until the database update
// (supabase/add-portfolios.sql) has run, it says so instead of failing.
import "../dx.css";
import "./portfolio.css";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { normLang } from "../../../lib/i18n.js";
import { pt } from "../../../lib/portfolioText.js";
import { createPortfolio } from "../../../lib/actions.js";
import { fmtDate } from "../../../lib/tz.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolios | VoltMira" };

export default async function PortfoliosPage() {
  const sb = await supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const { data: rows, error } = await sb.from("portfolios")
    .select("id, name, market, project_ids, updated_at").order("updated_at", { ascending: false });
  const needsDb = !!error && /portfolios|schema cache|does not exist/i.test(error.message || "");
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB";
  const defaultMarket = co?.default_market === "UA" ? "UA" : "MD";

  return (
    <div className="dx pf">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{pt("title", lang)}</h1>
          <p className="dx-summary">{pt("sub", lang)}</p>
        </div>
      </header>

      {needsDb ? (
        <section className="card"><p className="pf-warn" role="alert">{pt("needs_db", lang)}</p></section>
      ) : (
        <>
          <section className="card pf-new">
            <form action={createPortfolio} className="pf-new-form">
              <div className="field">
                <label htmlFor="pfName">{pt("new", lang)}</label>
                <input id="pfName" name="name" className="input" maxLength={160} placeholder={pt("new_name_ph", lang)} required />
              </div>
              <div className="field">
                <label htmlFor="pfMarket">{pt("market", lang)}</label>
                <select id="pfMarket" name="market" className="input" defaultValue={defaultMarket}>
                  <option value="MD">{pt("market_md", lang)}</option>
                  <option value="UA">{pt("market_ua", lang)}</option>
                </select>
              </div>
              <button type="submit" className="btn primary">{pt("new", lang)}</button>
            </form>
          </section>

          {(rows || []).length === 0 ? (
            <section className="card"><p className="dx-muted-note">{pt("empty_list", lang)}</p></section>
          ) : (
            <section className="pf-list">
              {rows.map((r) => (
                <Link key={r.id} href={`/portfolios/${r.id}`} className="card pf-item">
                  <b>{r.name || "Portfolio"}</b>
                  <span>{pt(r.market === "UA" ? "market_ua" : "market_md", lang)}, {pt("n_assets", lang, { n: (r.project_ids || []).length })}</span>
                  <small>{fmtDate(r.updated_at, loc)}</small>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
