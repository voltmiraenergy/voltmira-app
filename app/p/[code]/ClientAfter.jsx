// app/p/[code]/ClientAfter.jsx — the client's own page once they have signed.
// While the installation runs: how far along it is, each step with the date
// the installer recorded and what the step means, and who to ask. Once the
// system runs: what it has produced against what the offer said, what that
// energy is worth at the offer's prices, the steps folded away. Always: a way
// to recommend the installer (RecommendShare.jsx). Data from the offer
// route's `after` (lib/clientJourney.js). Server-rendered.
import { ppt } from "./text.js";
import { fmtDate } from "../../../lib/tz.js";
import { toIntlPhone } from "../../../lib/phone.js";
import RecommendShare from "./RecommendShare.jsx";
import ProdBars from "./ProdBars.jsx";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function ClientAfter({ after, lang, code, company, nf, fmt, preparedBy = null, market = "MD" }) {
  const loc = LOC[lang] || LOC.en;
  const day = (d) => fmtDate(`${d}T12:00:00Z`, loc, { day: "numeric", month: "long" });
  const monthLong = (m) => fmtDate(`${m}-15T12:00:00Z`, loc, { month: "long", year: "numeric" });
  const { steps = [], next = null, production, facts = {} } = after || {};
  const rows = production?.rows || [];
  const live = !next;
  const co = company.shortName || company.name || "";
  const nowIdx = steps.findIndex((s) => s.id === next);

  const stepList = (
    <ol className="pp-jsteps">
      {steps.map((s, i) => {
        const cls = s.at ? "done" : s.id === next ? "now" : "";
        return (
          <li key={s.id} className={cls}>
            <span className="pp-step-dot" aria-hidden="true">{s.at ? "" : i + 1}</span>
            <span className="pp-step-b">
              <span className="pp-step-t">{ppt("af_s_" + s.id, lang)}</span>
              {s.id === next && <span className="pp-step-x">{ppt("af_d_" + s.id, lang, { co })}</span>}
            </span>
            <span className="pp-step-d">{s.at ? day(s.at) : s.id === next ? ppt("af_next", lang) : ""}</span>
          </li>
        );
      })}
    </ol>
  );

  const phone = toIntlPhone(preparedBy?.phone, market);
  const ask = preparedBy?.name && phone ? (
    <div className="pp-card pp-af-ask">
      <div>
        <h3>{ppt("af_ask", lang)}</h3>
        <p>{ppt("af_ask_who", lang, { name: preparedBy.name, co })}</p>
      </div>
      <div className="pp-af-ask-btns">
        <a className="pp-btn pp-btn-ghost" href={`tel:+${phone}`}>{ppt("af_call", lang)}</a>
        <a className="pp-btn pp-wapp" href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
    </div>
  ) : null;

  return (
    <section className="pp-sec pp-after" aria-labelledby="pp-after-h">
      <header className="pp-af-head">
        <h2 className="pp-h2" id="pp-after-h">{ppt(live ? "af_h_live" : "af_h", lang)}</h2>
        <p className="pp-lead">{live ? ppt("af_sub_live", lang) : ppt("af_sub", lang, { step: ppt("af_s_" + next, lang) })}</p>
      </header>

      {!live && (
        <div className="pp-card pp-af-prog">
          <div className="pp-af-prog-top">
            <b>{ppt("af_progress", lang, { n: nowIdx + 1, t: steps.length })}</b>
            <span>{ppt("af_s_" + next, lang)}</span>
          </div>
          <div className="pp-af-track" aria-hidden="true">
            {steps.map((s) => <span key={s.id} className={s.at ? "on" : s.id === next ? "now" : ""} />)}
          </div>
          {stepList}
        </div>
      )}

      {live && (
        <div className="pp-card pp-prod">
          <h3>{ppt("af_prod_h", lang)}</h3>
          {rows.length ? (
            <>
              <dl className="pp-af-tiles">
                <div><dt>{ppt("af_t_total", lang)}</dt><dd>{nf(production.total, 0)} <small>kWh</small></dd><dd className="s">{ppt("af_t_total_s", lang, { n: rows.length })}</dd></div>
                {production.pct != null && (
                  <div className={production.pct >= 100 ? "up" : ""}><dt>{ppt("af_t_pct", lang)}</dt><dd>{nf(production.pct, 0)}%</dd><dd className="s">{ppt("af_t_pct_s", lang)}</dd></div>
                )}
                {facts.valueEur != null && fmt && (
                  <div><dt>{ppt("af_t_value", lang)}</dt><dd>{fmt(facts.valueEur)}</dd><dd className="s">{ppt("af_t_value_s", lang)}</dd></div>
                )}
                {facts.best && (
                  <div><dt>{ppt("af_t_best", lang)}</dt><dd>{nf(facts.best.kwh, 0)} <small>kWh</small></dd><dd className="s">{monthLong(facts.best.month)}</dd></div>
                )}
              </dl>
              <ProdBars rows={rows} lang={lang} nf={nf} best={facts.best} />
              <p className="pp-af-foot">
                {facts.last && ppt("af_last", lang, { m: monthLong(facts.last) })}
                {facts.days != null && <> {ppt("af_days", lang, { d: facts.days })}</>}
              </p>
            </>
          ) : (
            <p className="pp-prod-none">{ppt("af_prod_none", lang)}</p>
          )}
        </div>
      )}

      {ask}

      <div className="pp-card pp-rec">
        <h3>{ppt("rec_h", lang)}</h3>
        <p>{ppt("rec_p", lang, { co })}</p>
        <RecommendShare code={code} lang={lang} company={co} />
        <p className="pp-rec-note">{ppt("rec_get", lang)}</p>
      </div>

      {live && (
        <details className="pp-card pp-af-done">
          <summary>
            <span>{ppt("af_h", lang)}</span>
            <small>{ppt(facts.days != null ? "af_done_days" : "af_done", lang, { n: facts.done ?? steps.length, d: facts.days })}</small>
          </summary>
          {stepList}
        </details>
      )}
    </section>
  );
}
