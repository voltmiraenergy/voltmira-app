// app/d/[token]/page.jsx — the deal room a bank opens with its link: no
// account, read-only, open until the date the installer set. It shows the
// documents filed on each item of the permit checklist, with this bank's
// questions and the answers, the live credit summary of the plant (the same
// document as the bank pack, with its grid connection annex), and the pack to
// download. A closed, expired or unknown link shows one plain message, the
// same for all three, so a guessed token learns nothing. Every visit is
// logged for the installer (lib/dealLoad.js). Kept out of search engines by
// next.config.mjs and the metadata below.
import "../../(app)/dx.css";
import "../../(app)/portfolios/portfolio.css";
import "../../(app)/portfolios/[id]/report/report.css";
import "./deal.css";
import { headers } from "next/headers";
import { after } from "next/server";
import AppTheme from "../../(app)/AppTheme.jsx";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import CreditSummary from "../../(app)/portfolios/[id]/bank/CreditSummary.jsx";
import AskForm from "./AskForm.jsx";
import { loadDeal, logView } from "../../../lib/dealLoad.js";
import { notifyDealActivity } from "../../../lib/dealNotify.js";
import { docSetup } from "../../../lib/portfolioPrint.js";
import { normalizePlant } from "../../../lib/plantFinance.js";
import { permitProgress } from "../../../lib/plantPermits.js";
import { plt } from "../../../lib/plantText.js";
import { dt } from "../../../lib/dealText.js";
import { LINK_LANGS, docsByItem, docCounts, sizeText, isAnswered } from "../../../lib/dealRoom.js";
import { fmtDate, mdDayKey } from "../../../lib/tz.js";
import { reportId } from "../../../lib/reportId.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deal room | VoltMira", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const LOC = { en: "en-IE", ro: "ro-RO" };
/** Today in Moldova, for what is overdue on the checklist. */
const todayKey = () => mdDayKey(Date.now());

function Closed({ lang }) {
  return (
    <div className="app dl-app">
      <AppTheme />
      <HtmlLang lang={lang} />
      <main className="main"><div className="view dl-view">
        <section className="dl-closed">
          <p className="dl-kicker">{dt("b_kicker", lang)}</p>
          <h1>{dt("b_closed_h", lang)}</h1>
          <p>{dt("b_closed_p", lang)}</p>
        </section>
      </div></main>
    </div>
  );
}

export default async function DealPage(props) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const d = await loadDeal(token);
  const asked = LINK_LANGS.includes(sp?.lang) ? sp.lang : null;
  if (d.state !== "active") return <Closed lang={asked || "ro"} />;
  const { link, model, co, docs, questions } = d;
  const lang = asked || link.lang;
  await logView(link, "open", "", await headers());
  // the installer hears of it after the page is sent (lib/dealNotify.js)
  after(() => notifyDealActivity(link, "open"));

  const { money, date } = docSetup({ lang }, d);
  const pl = normalizePlant(model.assets[0].plant);
  const today = todayKey();
  const rows = permitProgress(pl.permits, today).rows;
  const byItem = docsByItem(docs);
  const counts = docCounts(docs);
  const docName = Object.fromEntries(docs.map((x) => [x.id, x.name]));
  const day = (iso) => fmtDate(iso, LOC[lang], { day: "numeric", month: "long", year: "numeric" });
  const items = [...rows.map((r) => ({ id: r.id, status: r.status })), ...(byItem.other.length || questions.some((q) => q.item_id === "other") ? [{ id: "other", status: null }] : [])];
  const href = (l) => `/d/${token}${l === link.lang ? "" : `?lang=${l}`}`;

  return (
    <div className="app dl-app">
      <AppTheme />
      <HtmlLang lang={lang} />
      <main className="main"><div className="view dl-view">
        <header className="dl-head">
          <div className="dl-title">
            <p className="dl-kicker">{dt("b_kicker", lang)}</p>
            <h1>{pl.name}</h1>
            <p className="dl-sub">{dt("b_shared", lang, { co: co.name || "VoltMira", bank: link.bank, date: day(link.expires_at) })}</p>
          </div>
          <nav className="dl-langs" aria-label={dt("b_lang", lang)}>
            {LINK_LANGS.map((l) => <a key={l} href={href(l)} aria-current={l === lang ? "true" : undefined} lang={l}>{l.toUpperCase()}</a>)}
          </nav>
        </header>

        <section className="dl-pack">
          <div>
            <a className="btn primary" href={`/api/deal/${token}/pack`}>{dt("b_pack", lang)}</a>
          </div>
          <p>{dt("b_pack_p", lang)}</p>
        </section>

        <nav className="dl-nav" aria-label={pl.name}>
          <a href="#docs">{dt("b_nav_docs", lang)}</a>
          <a href="#summary">{dt("b_nav_summary", lang)}</a>
        </nav>

        <section id="docs" className="dl-card" aria-labelledby="dl-docs-h">
          <h2 id="dl-docs-h">{dt("b_docs_h", lang)}</h2>
          <p className="dl-hint">{dt("b_docs_p", lang)}</p>
          <div className="dl-items">
            {items.map((it) => {
              const qs = questions.filter((q) => q.item_id === it.id);
              return (
                <article key={it.id} className={"dl-item" + (counts[it.id] ? " has-docs" : "")} id={"item-" + it.id}>
                  <div className="dl-item-h">
                    <h3>{plt("pm_" + it.id, lang)}</h3>
                    {it.status && <span className={"dl-st st-" + it.status}>{plt("ps_" + it.status, lang)}</span>}
                  </div>
                  {byItem[it.id].length ? (
                    <ul className="dl-files">
                      {byItem[it.id].map((x) => (
                        <li key={x.id}>
                          <a href={`/api/deal/${token}/doc/${x.id}`}>{x.name}</a>
                          <small>{sizeText(x.size_bytes, lang)}, {day(x.created_at)}</small>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="dl-none">{dt("b_no_docs", lang)}</p>}
                  {qs.length > 0 && (
                    <ul className="dl-qs">
                      {qs.map((q) => (
                        <li key={q.id}>
                          <p className="dl-q"><small>{dt("b_asked", lang, { date: day(q.created_at) })}{q.asked_by ? `, ${q.asked_by}` : ""}</small>{q.body}</p>
                          {isAnswered(q) ? (
                            <div className="dl-a">
                              <small>{dt("b_answer", lang)}{q.answered_at ? `, ${day(q.answered_at)}` : ""}</small>
                              {q.answer && <p>{q.answer}</p>}
                              {q.answer_doc_id && docName[q.answer_doc_id] && (
                                <p><a href={`/api/deal/${token}/doc/${q.answer_doc_id}`}>{dt("b_answer_doc", lang, { x: docName[q.answer_doc_id] })}</a></p>
                              )}
                            </div>
                          ) : <p className="dl-wait">{dt("b_waiting", lang)}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <AskForm token={token} item={it.id} lang={lang} />
                </article>
              );
            })}
          </div>
        </section>

        <section id="summary" className="dl-summary" aria-label={dt("b_nav_summary", lang)}>
          <div className="rp-wrap">
            <CreditSummary model={model} lang={lang} company={co.name || ""} date={date} money={money} fx={d.fx} todayKey={today} docCounts={counts} rid={reportId(model, today)} />
          </div>
        </section>

        <p className="dl-foot">{dt("b_note", lang)}</p>
      </div></main>
    </div>
  );
}
