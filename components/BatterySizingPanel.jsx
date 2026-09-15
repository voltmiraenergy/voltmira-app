"use client";
// components/BatterySizingPanel.jsx — "how much to store, not just how much to
// export", as one panel shared by the real project editor and Studio.
//
// The curve is the engine run at every capacity from 0 to 10 kWh for THIS
// client, so the recommended size is a computed number rather than a rule of
// thumb. The knee (dashed amber) is where the next kWh stops paying for itself;
// the solid dot is the capacity currently quoted.
import { useMemo } from "react";
import { batterySweep } from "../lib/quoteAnalysis.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

function Curve({ pts, deltas, knee, paysOff, current, max, step, money }) {
  // Plot the value ADDED over having no battery at all, not the absolute yearly
  // saving. Against an absolute axis the whole curve sits near the top and looks
  // flat — the €100 that decides the battery is invisible next to the €700 the
  // panels earn regardless.
  //
  // The axis has to span negatives too: where storage costs more than it saves
  // the curve belongs BELOW the zero line, not clipped flat against it.
  const W = 640, H = 200, PADL = 56, PADR = 16, PADT = 20, PADB = 28;
  const hi = Math.max(...deltas, 0), lo = Math.min(...deltas, 0);
  const pad = (hi - lo) * 0.12 || 1;
  const top = hi + pad, bot = lo - pad;
  const X = (b) => PADL + (b / max) * (W - PADL - PADR);
  const Y = (v) => PADT + (1 - (v - bot) / (top - bot)) * (H - PADT - PADB);
  const zero = Y(0);
  const curBucket = Math.min(max, Math.max(0, Math.round((current || 0) / step) * step));
  const curIdx = Math.max(0, pts.findIndex((p) => Math.abs(p.b - curBucket) < 1e-9));
  const line = pts.map((p, i) => (i ? "L" : "M") + X(p.b).toFixed(1) + " " + Y(deltas[i]).toFixed(1)).join(" ");
  const area = `${line} L ${X(max).toFixed(1)} ${zero.toFixed(1)} L ${X(0).toFixed(1)} ${zero.toFixed(1)} Z`;
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i);
  const good = deltas[curIdx] >= 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 640, display: "block" }} role="img"
      aria-label="Valoare anuală adăugată de baterie, pe capacitate">
      {/* the area is clipped at the zero line on each side, so a loss reads red */}
      <path d={area} fill={hi > 0 ? "var(--green)" : "#C4543B"} opacity=".14" />
      <line x1={PADL} y1={zero} x2={W - PADR} y2={zero} stroke="var(--line)" strokeWidth="1.2" />
      <text x={PADL - 7} y={zero + 3} textAnchor="end" fontSize="8.5" fill="var(--muted)">{money(0)}</text>
      <text x={PADL - 7} y={Y(hi) + 3} textAnchor="end" fontSize="8.5" fill="var(--muted)">{money(hi)}</text>
      {lo < 0 && <text x={PADL - 7} y={Y(lo) + 3} textAnchor="end" fontSize="8.5" fill="#B4472F">{money(lo)}</text>}
      <path d={line} fill="none" stroke={hi > 0 ? "var(--green)" : "#C4543B"} strokeWidth="2.4" strokeLinecap="round" />
      {paysOff && (
        <>
          <line x1={X(knee)} y1={PADT} x2={X(knee)} y2={Y(bot)} stroke="var(--amber)" strokeWidth="1.3" strokeDasharray="3 3" />
          <text x={X(knee)} y={PADT - 6} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--amber)">{knee.toFixed(1)} kWh</text>
        </>
      )}
      <circle cx={X(pts[curIdx].b)} cy={Y(deltas[curIdx])} r="4.5"
        fill={good ? "var(--ink)" : "#C4543B"} stroke="var(--paper-2)" strokeWidth="1.5" />
      {ticks.map((b, i) => (
        <text key={b} x={X(b)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--muted)">
          {Math.round(b)}{i === ticks.length - 1 ? " kWh" : ""}
        </text>
      ))}
    </svg>
  );
}

/**
 * @param {object} base     engine inputs without batt/battKwh
 * @param {object} E        engine settings
 * @param {number} battKwh  the capacity currently quoted
 * @param {(kwh:number)=>void} onApply  apply the recommendation
 * @param {(e:number)=>string} money    the host's own currency formatter
 * @param {{retailMdl,buybackMdl,spreadMdl}?} spread  shown as the "why" line when present
 */
export default function BatterySizingPanel({ lang, base, E, battKwh, onApply, money, spread, netMetering = false, className = "card" }) {
  const sweep = useMemo(() => batterySweep(base, E, battKwh), [base, E, battKwh]);
  const gap = Math.abs(battKwh - sweep.knee);
  const curDelta = sweep.atCurrent - sweep.base0;

  return (
    <section className={className}>
      <h3>{t3(lang, "Cât să stochezi, nu doar cât să exporți", "How much to store, not just export", "Сколько хранить, а не только экспортировать")}</h3>
      <p className="bsp-lead">
        {spread
          ? t3(lang,
              `Fiecare kWh exportat se răscumpără la ${spread.buybackMdl.toFixed(2)} lei; același kWh, stocat și folosit seara, valorează tariful din factură (${spread.retailMdl.toFixed(2)} lei). Diferența de ${spread.spreadMdl.toFixed(2)} lei e tot ce câștigă bateria pe kWh — curba de mai jos e calculul motorului pentru acest client.`,
              `Every exported kWh is bought back at ${spread.buybackMdl.toFixed(2)} lei; the same kWh, stored and used in the evening, is worth the retail tariff (${spread.retailMdl.toFixed(2)} lei). The ${spread.spreadMdl.toFixed(2)} lei difference is all the battery earns per kWh — the curve below is the engine's calculation for this client.`,
              `Каждый экспортированный кВт·ч выкупается по ${spread.buybackMdl.toFixed(2)} лей; тот же кВт·ч, сохранённый на вечер, стоит розничный тариф (${spread.retailMdl.toFixed(2)} лей). Разница в ${spread.spreadMdl.toFixed(2)} лей — весь заработок батареи на кВт·ч.`)
          : t3(lang,
              "Surplusul exportat se creditează sub prețul din factură, iar același kWh stocat și folosit seara valorează tariful întreg. Curba de mai jos e calculul motorului pentru acest client — nu o ilustrare.",
              "Exported surplus is credited below the retail price, while the same kWh stored and used in the evening is worth the full tariff. The curve below is the engine's own calculation for this client — not an illustration.",
              "Экспортируемый излишек кредитуется ниже розничной цены, а тот же кВт·ч, сохранённый на вечер, стоит полный тариф. График ниже — расчёт движка для этого клиента.")}
      </p>

      <Curve pts={sweep.pts} deltas={sweep.deltas} knee={sweep.knee} paysOff={sweep.paysOff}
        current={battKwh} max={sweep.max} step={sweep.step} money={money} />

      <div className="bsp-metrics">
        <div className={"bsp-m" + (sweep.paysOff ? " good" : " bad")}>
          <b>{sweep.paysOff ? `${sweep.knee.toFixed(1)} kWh` : t3(lang, "fără baterie", "no battery", "без батареи")}</b>
          <span>{t3(lang, "recomandat pentru acest client", "recommended for this client", "рекомендовано клиенту")}</span>
        </div>
        <div className="bsp-m"><b>{money(sweep.atKnee - sweep.base0)}</b><span>{t3(lang, "valoare anuală la recomandare", "annual value at the recommendation", "годовая ценность (рекоменд.)")}</span></div>
        <div className="bsp-m"><b>{battKwh.toFixed(1)} kWh</b><span>{t3(lang, "baterie aleasă acum", "battery picked now", "выбрано сейчас")}</span></div>
        <div className={"bsp-m" + (curDelta < 0 ? " bad" : "")}>
          <b>{money(curDelta)}</b><span>{t3(lang, "valoare anuală la alegerea actuală", "annual value at the current pick", "годовая ценность сейчас")}</span>
        </div>
      </div>

      {/* When storage never pays, saying so is the useful answer — the old panel
          fell through to "fit the biggest battery swept" and recommended one
          that lost money every year. */}
      {!sweep.paysOff && (
        <div className="bsp-verdict">
          {t3(lang,
            `Pe acest client bateria nu se amortizează la nicio capacitate: fiecare kWh de stocare costă mai mult decât economisește${netMetering ? ", pentru că la contorizare netă 1:1 exportul se creditează deja la prețul din factură" : ""}. ${battKwh > 0 ? `Capacitatea aleasă acum (${battKwh.toFixed(1)} kWh) scade economia anuală cu ${money(Math.abs(curDelta))}.` : ""}`,
            `Storage doesn't pay for this client at any capacity: every stored kWh costs more than it saves${netMetering ? ", because 1:1 net metering already credits exports at the retail price" : ""}. ${battKwh > 0 ? `The ${battKwh.toFixed(1)} kWh currently quoted reduces the annual saving by ${money(Math.abs(curDelta))}.` : ""}`,
            `Для этого клиента батарея не окупается ни при какой ёмкости${netMetering ? ": при нетто-учёте 1:1 экспорт и так кредитуется по розничной цене" : ""}. ${battKwh > 0 ? `Выбранные ${battKwh.toFixed(1)} кВт·ч уменьшают годовую экономию на ${money(Math.abs(curDelta))}.` : ""}`)}
        </div>
      )}

      {onApply && gap > 0.4 && (
        <button type="button" className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => onApply(sweep.knee)}>
          {sweep.paysOff
            ? t3(lang, `Aplică ${sweep.knee.toFixed(1)} kWh`, `Apply ${sweep.knee.toFixed(1)} kWh`, `Применить ${sweep.knee.toFixed(1)} кВт·ч`)
            : t3(lang, "Scoate bateria din ofertă", "Remove the battery from the offer", "Убрать батарею из предложения")}
        </button>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .bsp-lead{font-size:12.5px;color:var(--muted);margin:6px 0 14px;max-width:70ch;line-height:1.55}
        /* four tiles: 4-up wide, 2x2 narrow — never 3 + a lonely one */
        .bsp-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
        @media(max-width:900px){.bsp-metrics{grid-template-columns:1fr 1fr}}
        .bsp-m{background:var(--paper);border:1px solid var(--line);border-radius:11px;padding:11px 13px}
        .bsp-m b{display:block;font-family:var(--font-d,inherit);font-size:18px;font-weight:700;letter-spacing:-.01em;
          font-variant-numeric:tabular-nums;color:var(--ink)}
        .bsp-m.good b{color:var(--green)}
        .bsp-m.bad b{color:#B4472F}
        .bsp-m span{display:block;margin-top:2px;font-size:10.5px;color:var(--muted);line-height:1.35}
        .bsp-verdict{margin-top:12px;padding:11px 13px;background:var(--amber-tint);border-radius:10px;
          font-size:12.5px;line-height:1.55;color:var(--ink)}
      ` }} />
    </section>
  );
}
