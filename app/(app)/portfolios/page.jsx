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
import { createSampleProject, createPlantProject } from "../../../lib/plantActions.js";
import { plt } from "../../../lib/plantText.js";
import { PLANTS_KEY } from "../../../lib/portfolioModel.js";
import SubmitButton from "./SubmitButton.jsx";
import { fmtDate } from "../../../lib/tz.js";
import { appTitle } from "../../../lib/pageTitle.js";
import { dlt } from "../../../lib/deadlineText.js";
import { collectDeadlines } from "../../../lib/deadlines.js";
import { mdDayKey } from "../../../lib/tz.js";

export const dynamic = "force-dynamic";
// the public lookups behind this page's actions (wind, sun, grid) can take a while
export const maxDuration = 60;
export const generateMetadata = appTitle((lang) => pt("nav", lang));

/** Today in Moldova, for what is late. */
const todayKey = () => mdDayKey(Date.now());

export default async function PortfoliosPage(props) {
  const sp = (await props.searchParams) || {};
  const err = ["failed", "rate_limited"].includes(sp.err) ? sp.err : null;
  const sb = await supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const { data: rows, error } = await sb.from("portfolios")
    .select("id, name, market, project_ids, assets, updated_at").order("updated_at", { ascending: false });
  const needsDb = !!error && /portfolios|schema cache|does not exist/i.test(error.message || "");
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB";
  const defaultMarket = co?.default_market === "UA" ? "UA" : "MD";
  const dd = collectDeadlines(rows || [], todayKey());

  return (
    <div className="dx pf">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{pt("title", lang)}</h1>
          <p className="dx-summary">{pt("sub", lang)}</p>
        </div>
        {!needsDb && (rows || []).some((r) => r.assets?.__plants?.length) && (
          <Link className="btn ghost" href="/portfolios/deadlines">{dlt("link", lang)}{dd.late > 0 ? `, ${dlt("link_late", lang, { n: dd.late })}` : ""}</Link>
        )}
      </header>

      {needsDb ? (
        <section className="card"><p className="pf-warn" role="alert">{pt("needs_db", lang)}</p></section>
      ) : (
        <>
          {err && <section className="card"><p className="pf-warn" role="alert">{plt("err_" + err, lang)}</p></section>}

          {/* ---- large projects: a plant of its own, or a sample to explore */}
          <section className="card pf-plants-card" aria-labelledby="pf-plants-h">
            <div className="dx-card-head"><div><h2 id="pf-plants-h">{plt("card_h", lang)}</h2><p>{plt("card_p", lang)}</p></div></div>
            <div className="pf-plants-acts">
              <form action={createSampleProject}>
                <input type="hidden" name="kind" value="hybrid" />
                <SubmitButton className="btn primary">{plt("sample_hybrid", lang)}</SubmitButton>
              </form>
              <form action={createSampleProject}>
                <input type="hidden" name="kind" value="rooftops" />
                <SubmitButton className="btn ghost">{plt("sample_roofs", lang)}</SubmitButton>
              </form>
            </div>
            <p className="pf-hint">{plt("sample_wait", lang)}</p>
            <form action={createPlantProject} className="pf-new-form pf-plant-new">
              <div className="field">
                <label htmlFor="plName">{plt("new_plant", lang)}</label>
                <input id="plName" name="name" className="input" maxLength={160} placeholder={plt("new_plant_ph", lang)} required />
              </div>
              <SubmitButton className="btn">{plt("new_plant", lang)}</SubmitButton>
            </form>
          </section>

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
                  <span>
                    {pt(r.market === "UA" ? "market_ua" : "market_md", lang)}
                    {(r.project_ids || []).length > 0 || !(r.assets?.[PLANTS_KEY] || []).length ? `, ${pt("n_assets", lang, { n: (r.project_ids || []).length })}` : ""}
                    {(r.assets?.[PLANTS_KEY] || []).length > 0 ? `, ${plt("n_plants", lang, { n: r.assets[PLANTS_KEY].length })}` : ""}
                  </span>
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
