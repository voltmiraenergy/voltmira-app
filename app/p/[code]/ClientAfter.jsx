// app/p/[code]/ClientAfter.jsx — the client's own page once they have signed:
// their installation step by step (with the dates the installer recorded),
// what their system has produced each month against what the offer said, and
// a way to recommend the installer (RecommendShare.jsx). Data from the offer
// route's `after` (lib/clientJourney.js). Server-rendered.
import { ppt } from "./text.js";
import { fmtDate } from "../../../lib/tz.js";
import RecommendShare from "./RecommendShare.jsx";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function ClientAfter({ after, lang, code, company, nf }) {
  const loc = LOC[lang] || LOC.en;
  const day = (d) => fmtDate(`${d}T12:00:00Z`, loc, { day: "numeric", month: "long" });
  const month = (m) => fmtDate(`${m}-15T12:00:00Z`, loc, { month: "short" });
  const { steps = [], next = null, production } = after || {};
  const rows = production?.rows || [];
  const top = Math.max(1, ...rows.map((r) => Math.max(r.kwh, r.expected || 0)));
  const allDone = !next;

  return (
    <section className="pp-sec pp-after" aria-labelledby="pp-after-h">
      <h2 className="pp-h2" id="pp-after-h">{ppt(allDone ? "af_h_live" : "af_h", lang)}</h2>
      <p className="pp-lead">{allDone ? ppt("af_sub_live", lang) : ppt("af_sub", lang, { step: ppt("af_s_" + next, lang) })}</p>

      <ol className="pp-jsteps">
        {steps.map((s) => (
          <li key={s.id} className={s.at ? "done" : s.id === next ? "now" : ""}>
            <span className="pp-step-dot" aria-hidden="true" />
            <span className="pp-step-t">{ppt("af_s_" + s.id, lang)}</span>
            <span className="pp-step-d">{s.at ? day(s.at) : s.id === next ? ppt("af_next", lang) : ""}</span>
          </li>
        ))}
      </ol>

      {steps.find((s) => s.id === "live")?.at && (
        <div className="pp-card pp-prod">
          <h3>{ppt("af_prod_h", lang)}</h3>
          {rows.length ? (
            <>
              <p className="pp-prod-sum">
                {ppt("af_prod_sum", lang, { kwh: nf(production.total, 0), n: rows.length })}
                {production.pct != null && <> {ppt("af_prod_pct", lang, { p: nf(production.pct, 0) })}</>}
              </p>
              <div className="pp-bars" role="img" aria-label={rows.map((r) => `${month(r.month)} ${nf(r.kwh, 0)} kWh`).join(", ")}>
                {rows.map((r) => (
                  <div key={r.month} className="pp-bar">
                    <div className="pp-bar-col">
                      {r.expected != null && <span className="pp-bar-exp" style={{ bottom: `${(r.expected / top) * 100}%` }} />}
                      <span className="pp-bar-act" style={{ height: `${(r.kwh / top) * 100}%` }} />
                    </div>
                    <span className="pp-bar-m">{month(r.month)}</span>
                  </div>
                ))}
              </div>
              <p className="pp-prod-key"><span className="k-act" />{ppt("af_k_act", lang)} <span className="k-exp" />{ppt("af_k_exp", lang)}</p>
            </>
          ) : (
            <p className="pp-prod-none">{ppt("af_prod_none", lang)}</p>
          )}
        </div>
      )}

      <div className="pp-card pp-rec">
        <h3>{ppt("rec_h", lang)}</h3>
        <p>{ppt("rec_p", lang, { co: company.shortName || company.name || "" })}</p>
        <RecommendShare code={code} lang={lang} company={company.shortName || company.name || ""} />
      </div>
    </section>
  );
}
