// components/energy/CnedCards.jsx — three cards on /energy drawn from CNED's
// register, server-side and in plain HTML: prosumers moving from net metering
// to net billing, the energy renewables produce each year, and the battery
// storage connected to the grid. The page passes them only while CNED_DATA is
// on (lib/cnedData.js); every figure is CNED's, with its date. Biogas is
// outside VoltMira's scope: it is not drawn, only named inside the total.
import { ct } from "../../lib/cnedText.js";
import { raionName } from "../../lib/mdRaions.js";
import { num } from "../../lib/portfolioFormat.js";
import { Users, Sun, BatteryCharging } from "lucide-react";

const HI = { size: 18, strokeWidth: 1.9, "aria-hidden": true };
const mwU = (lang) => (lang === "ru" || lang === "uk" ? "МВт" : "MW");
const mwhU = (lang) => ({ ru: "МВт·ч", uk: "МВт·год" }[lang] || "MWh");
const mw = (kw, lang) => `${num(kw / 1000, lang, 1)} ${mwU(lang)}`;

export default function CnedCards({ lang = "en", yearly, production, totals, stats, source }) {
  // ---- prosumers by scheme, at each year end
  const years = Object.keys(yearly.prosumers).map(Number).sort((a, b) => a - b);
  const pros = years.map((y) => ({ y, cn: yearly.prosumers[y].cn?.kw || 0, fn: yearly.prosumers[y].fn?.kw || 0 }));
  const prosMax = Math.max(...pros.map((p) => p.cn + p.fn), 1);
  const cnFinal = pros.at(-1)?.cn || 0;
  const cnStill = pros.find((p) => Math.abs(p.cn - cnFinal) < 1)?.y;
  const p = totals.prosumers;

  // ---- production per year, GWh
  const pYears = Object.keys(production).filter((y) => production[y].all != null).sort();
  const shown = pYears.filter((y) => ["pv", "wind", "hydro", "prosumers"].some((k) => production[y][k] != null));
  const parts = (y) => ["pv", "wind", "hydro", "prosumers"].reduce((s, k) => s + (production[y][k] || 0), 0);
  const prodMax = Math.max(...shown.map((y) => production[y].all), 1);
  const gwh = (mwh) => `${num(mwh / 1000, lang, mwh >= 100000 ? 0 : 1)} ${ct("gwh", lang)}`;
  const last = shown.at(-1), first = shown.find((y) => (production[y].pv || 0) > 0);

  const bessRows = stats.filter((s) => s.bess).sort((a, b) => b.bess.kwh - a.bess.kwh);

  return (
    <>
      <div className="en-two">
        <section className="dx-card" aria-labelledby="cn-sch-h">
          <header className="dx-card-head"><div><h2 id="cn-sch-h"><Users {...HI} />{ct("sch_h", lang)}</h2><p>{ct("sch_s", lang)}</p></div></header>
          <ol className="cn-stack" aria-label={ct("sch_h", lang)}>
            {pros.map((r) => (
              <li key={r.y}>
                <b>{num((r.cn + r.fn) / 1000, lang, 1)}</b>
                <span className="col" style={{ height: `${((r.cn + r.fn) / prosMax) * 100}%` }} aria-hidden="true">
                  <i className="s-cn" style={{ height: `${(r.cn / Math.max(1, r.cn + r.fn)) * 100}%` }} />
                  <i className="s-fn" style={{ height: `${(r.fn / Math.max(1, r.cn + r.fn)) * 100}%` }} />
                </span>
                <small>{r.y}</small>
              </li>
            ))}
          </ol>
          <ul className="cn-key"><li><i className="s-cn" />{ct("cn_l", lang)}</li><li><i className="s-fn" />{ct("fn_l", lang)}</li></ul>
          {cnStill && cnStill < years.at(-1) && <p className="en-note">{ct("sch_note", lang, { y: cnStill, cn: mw(cnFinal, lang) })}</p>}
          <p className="en-note">{ct("sch_who", lang, { pf: mw(p.pf.kw, lang), pfn: num(p.pf.n, lang, 0), pj: mw(p.pj.kw, lang), pjn: num(p.pj.n, lang, 0) })}</p>
          <p className="en-note">{source}</p>
        </section>

        <section className="dx-card" aria-labelledby="cn-prod-h">
          <header className="dx-card-head"><div><h2 id="cn-prod-h"><Sun {...HI} />{ct("prod_h", lang)}</h2><p>{ct("prod_s", lang)}</p></div></header>
          <ol className="cn-stack" aria-label={ct("prod_h", lang)}>
            {shown.map((y) => {
              const r = production[y], tot = parts(y);
              return (
                <li key={y}>
                  <b>{num(r.all / 1000, lang, 0)}</b>
                  <span className="col" style={{ height: `${(tot / prodMax) * 100}%` }} aria-hidden="true">
                    {["pv", "wind", "hydro", "prosumers"].map((k) => <i key={k} className={"s-" + (k === "prosumers" ? "pros" : k)} style={{ height: `${((r[k] || 0) / Math.max(1, tot)) * 100}%` }} />)}
                  </span>
                  <small>{y}</small>
                </li>
              );
            })}
          </ol>
          <ul className="cn-key">
            <li><i className="s-pv" />{ct("tech_pv", lang)}</li><li><i className="s-wind" />{ct("tech_wind", lang)}</li>
            <li><i className="s-hydro" />{ct("tech_hydro", lang)}</li><li><i className="s-pros" />{ct("prod_prosumers", lang)}</li>
          </ul>
          {last && <p className="en-note">{ct("prod_total", lang, { t: gwh(production[last].all), y: last, o: gwh(Math.max(0, production[last].all - parts(last))) })}</p>}
          {first && last && first !== last && <p className="en-note">{ct("prod_note", lang, { a: gwh(production[first].pv), y0: first, b: gwh(production[last].pv), y1: last })}</p>}
          <p className="en-note">{source}</p>
        </section>
      </div>

      {totals.bess?.n > 0 && (
        <section className="dx-card" aria-labelledby="cn-bess-h">
          <header className="dx-card-head"><div><h2 id="cn-bess-h"><BatteryCharging {...HI} />{ct("bess_h", lang)}</h2>
            <p>{ct("bess_v", lang, { kwh: `${num(totals.bess.kwh / 1000, lang, 1)} ${mwhU(lang)}`, mw: mw(totals.bess.kw, lang), n: num(totals.bess.n, lang, 0) })}</p></div></header>
          <ul className="cn-bess">
            {bessRows.map((s) => (
              <li key={s.id}><b>{raionName(s.id, lang)}</b><span>{num(s.bess.kwh / 1000, lang, 1)} {mwhU(lang)}, {mw(s.bess.kw, lang)}, {s.bess.n === 1 ? ct("inst_one", lang) : ct("inst_n", lang, { n: num(s.bess.n, lang, 0) })}</span></li>
            ))}
          </ul>
          <p className="en-note">{source}</p>
        </section>
      )}
    </>
  );
}
