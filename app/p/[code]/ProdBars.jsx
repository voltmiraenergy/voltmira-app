// app/p/[code]/ProdBars.jsx — a system's monthly production as bars, each
// with the offer's expectation for that month as a dashed line across it
// (lib/clientJourney.js productionSeries). Used on the client's own page
// (ClientAfter.jsx) and on a recommendation (app/r/[code]). Server-rendered.
import { ppt, kwhUnit } from "./text.js";
import { fmtDate } from "../../../lib/tz.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function ProdBars({ rows, lang, nf, best = null, compact = false }) {
  const loc = LOC[lang] || LOC.en;
  const month = (m) => fmtDate(`${m}-15T12:00:00Z`, loc, { month: "short" });
  const top = Math.max(1, ...rows.map((r) => Math.max(r.kwh, r.expected || 0)));
  const anyExp = rows.some((r) => r.expected != null);
  return (
    <figure className={"pp-bars-fig" + (compact ? " compact" : "")}>
      <div className="pp-bars" role="img" aria-label={rows.map((r) => `${month(r.month)} ${nf(r.kwh, 0)} ${kwhUnit(lang)}`).join(", ")}>
        {rows.map((r) => (
          <div key={r.month} className={"pp-bar" + (best && r.month === best.month ? " best" : "")} title={`${month(r.month)}: ${nf(r.kwh, 0)} ${kwhUnit(lang)}`}>
            <div className="pp-bar-col">
              {r.expected != null && <span className="pp-bar-exp" style={{ bottom: `${(r.expected / top) * 100}%` }} />}
              <span className="pp-bar-act" style={{ height: `${(r.kwh / top) * 100}%` }}>
                <span className="pp-bar-v">{nf(r.kwh, 0)}</span>
              </span>
            </div>
            <span className="pp-bar-m">{month(r.month)}</span>
          </div>
        ))}
      </div>
      <figcaption className="pp-prod-key">
        <span className="k-act" />{ppt("af_k_act", lang)} ({kwhUnit(lang)})
        {anyExp && <><span className="k-exp" />{ppt("af_k_exp", lang)}</>}
      </figcaption>
    </figure>
  );
}
