"use client";
// components/SurplusPanel.jsx — what the exported surplus is actually worth,
// from the operator's published monthly buy-back table.
//
// Shared by the real project editor and Studio so both quote the same price.
// Moldova only: RO's net metering credits exports 1:1 at retail, so there is no
// separate buy-back price to weight.
import { useMemo } from "react";
import { SOLAR_SEASON } from "@voltmira/engine";
import {
  latestSeasonalMdl, weightedExportPriceMdl, weightedExportPriceEur, flatAverageMdl,
  annualAverages, storageSpreadMdl, MONTHS_RO, BUYBACK_SOURCE,
} from "../lib/prosumerPrice.js";
import { surplusRevenue } from "../lib/quoteAnalysis.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

/** Everything the panel needs, so a host can also use the numbers on their own. */
export function useBuyback(retailEur, mdlPerEur) {
  return useMemo(() => ({
    seasonal: latestSeasonalMdl(),
    weightedMdl: weightedExportPriceMdl(SOLAR_SEASON),
    weightedEur: weightedExportPriceEur(SOLAR_SEASON, mdlPerEur),
    flatMdl: flatAverageMdl(),
    years: annualAverages(),
    spread: storageSpreadMdl((Number(retailEur) || 0) * mdlPerEur, SOLAR_SEASON),
  }), [retailEur, mdlPerEur]);
}

// The operator's published monthly price as bars, with the shape of when a PV
// system actually exports drawn behind it. The two point opposite ways — the
// price is lowest in the months that produce the most surplus — and that gap is
// exactly why the weighted average (dashed) is the number that belongs in an offer.
function BuybackChart({ seasonal, weights, weighted, months, lang }) {
  // PADR holds the weighted-average callout outside the plot, so it can never
  // land on a bar's own value label.
  const W = 700, H = 220, PADL = 34, PADR = 92, PADT = 20, PADB = 44;
  const vals = seasonal.filter((v) => v != null);
  const maxP = (Math.max(...vals, weighted) || 1) * 1.14;
  const bw = (W - PADL - PADR) / 12;
  const Y = (v) => PADT + (1 - v / maxP) * (H - PADT - PADB);
  const base = Y(0);
  const maxW = Math.max(...weights) || 1;
  // the surplus shape is a shape, not a second value axis: it fills from the
  // baseline up to at most 78% of the plot, behind the bars.
  const SY = (w) => base - (w / maxW) * (base - PADT) * 0.78;
  const shape = weights.map((w, i) => (i ? "L" : "M") + (PADL + bw * (i + 0.5)).toFixed(1) + " " + SY(w).toFixed(1)).join(" ");
  const ticks = [1, 2, 3, 4].filter((v) => v < maxP);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 700, display: "block" }} role="img"
      aria-label="Preț lunar de răscumpărare vs. lunile în care sistemul exportă surplus">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PADL} y1={Y(v)} x2={W - PADR} y2={Y(v)} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
          <text x={PADL - 6} y={Y(v) + 3} textAnchor="end" fontSize="8.5" fill="var(--muted)">{v}</text>
        </g>
      ))}
      <path d={`${shape} L ${(PADL + bw * 11.5).toFixed(1)} ${base} L ${(PADL + bw * 0.5).toFixed(1)} ${base} Z`}
        fill="var(--amber)" opacity=".2" />
      <path d={shape} fill="none" stroke="var(--amber)" strokeWidth="1.6" opacity=".85" />
      {seasonal.map((p, i) => {
        if (p == null) return null;
        const x = PADL + bw * i + bw * 0.2;
        return (
          <g key={i}>
            <rect x={x} y={Y(p)} width={bw * 0.6} height={Math.max(1, base - Y(p))} rx="2.5" fill="var(--green)" opacity=".86" />
            <text x={x + bw * 0.3} y={Y(p) - 4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--green)">{p.toFixed(2)}</text>
          </g>
        );
      })}
      <line x1={PADL} y1={Y(weighted)} x2={W - PADR + 6} y2={Y(weighted)} stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="5 3" />
      <text x={W - PADR + 10} y={Y(weighted) - 1} fontSize="11" fontWeight="700" fill="var(--ink)">{weighted.toFixed(2)} lei</text>
      <text x={W - PADR + 10} y={Y(weighted) + 11} fontSize="8" fill="var(--muted)">{t3(lang, "ponderat", "weighted", "взвеш.")}</text>
      <line x1={PADL} y1={base} x2={W - PADR} y2={base} stroke="var(--line)" strokeWidth="1" />
      {months.map((m, i) => (
        <text key={m} x={PADL + bw * (i + 0.5)} y={H - 24} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{m}</text>
      ))}
      <rect x={PADL} y={H - 15} width="9" height="9" rx="2" fill="var(--green)" opacity=".86" />
      <text x={PADL + 14} y={H - 7} fontSize="8.5" fill="var(--muted)">
        {t3(lang, "lei/kWh plătiți de operator", "lei/kWh paid by the operator", "лей/кВт·ч платит оператор")}</text>
      <rect x={PADL + 176} y={H - 15} width="9" height="9" rx="2" fill="var(--amber)" opacity=".45" />
      <text x={PADL + 190} y={H - 7} fontSize="8.5" fill="var(--muted)">
        {t3(lang, "când sistemul exportă surplus", "when the system exports surplus", "когда система отдаёт излишек")}</text>
    </svg>
  );
}

/**
 * @param {object} buyback  from useBuyback()
 * @param {number} prodKwh  year-1 production
 * @param {number} selfRatio  share of production self-consumed
 * @param {number} mdlPerEur
 * @param {(e:number)=>string} money  the host's own EUR formatter
 * @param {(n:number)=>string} num    the host's own integer formatter
 */
export default function SurplusPanel({ lang, buyback, prodKwh, selfRatio, mdlPerEur, money, num, className = "card" }) {
  const surplus = useMemo(
    () => surplusRevenue(prodKwh, selfRatio, mdlPerEur),
    [prodKwh, selfRatio, mdlPerEur]);

  return (
    <section className={className}>
      <div className="sp-head">
        <h3 style={{ margin: 0, flex: 1 }}>{t3(lang, "Vânzarea surplusului", "Selling the surplus", "Продажа излишка")}</h3>
        <span className="sp-src"><b>{BUYBACK_SOURCE.operator}</b> — {t3(lang, BUYBACK_SOURCE.label.ro, BUYBACK_SOURCE.label.en, BUYBACK_SOURCE.label.ru)}</span>
      </div>
      <p className="sp-lead">
        {t3(lang,
          "Prețul de răscumpărare nu e o constantă — variază lună de lună și e cel mai mic exact primăvara-vara, când sistemul produce cel mai mult surplus. De asta prețul corect de pus în ofertă e media ponderată cu surplusul, nu media anuală simplă.",
          "The buy-back price isn't a constant — it moves month to month, and it's lowest in exactly the spring and summer months when a PV system exports most. So the right figure for an offer is the surplus-weighted average, not the plain yearly mean.",
          "Цена выкупа не постоянна — она меняется помесячно и ниже всего именно весной и летом, когда система отдаёт больше всего излишка. Поэтому в расчёт идёт средневзвешенная по излишку, а не простое годовое среднее.")}
      </p>

      <BuybackChart lang={lang} seasonal={buyback.seasonal} weights={SOLAR_SEASON} weighted={buyback.weightedMdl} months={MONTHS_RO} />

      <div className="sp-metrics">
        <div className="sp-m good"><b>{buyback.weightedMdl.toFixed(2)} lei</b><span>{t3(lang, "preț ponderat cu surplusul · /kWh", "surplus-weighted price · /kWh", "взвеш. цена · /кВт·ч")}</span></div>
        <div className="sp-m"><b>{buyback.flatMdl.toFixed(2)} lei</b><span>{t3(lang, "medie calendaristică simplă", "plain calendar average", "простое среднее")}</span></div>
        <div className="sp-m"><b>{num(surplus.totalKwh)} kWh</b><span>{t3(lang, "surplus exportat / an", "surplus exported / yr", "излишек за год")}</span></div>
        <div className="sp-m good"><b>{num(surplus.mdl)} lei</b><span>{t3(lang, "venit din surplus / an", "surplus revenue / yr", "доход с излишка / год")}</span></div>
      </div>

      <div className="sp-spread">
        <b>{buyback.spread.spreadMdl.toFixed(2)} lei</b>
        <span>
          {t3(lang,
            `este cât valorează un kWh STOCAT, nu vândut: ${buyback.spread.retailMdl.toFixed(2)} lei tarif de la rețea − ${buyback.spread.buybackMdl.toFixed(2)} lei răscumpărare = ${buyback.spread.spreadMdl.toFixed(2)} lei (${buyback.spread.sharePct.toFixed(0)}% din tarif). Asta câștigă bateria pe fiecare kWh ciclat — nu tariful întreg, cum se scrie des în oferte.`,
            `is what a kWh is worth STORED rather than sold: ${buyback.spread.retailMdl.toFixed(2)} lei grid tariff − ${buyback.spread.buybackMdl.toFixed(2)} lei buy-back = ${buyback.spread.spreadMdl.toFixed(2)} lei (${buyback.spread.sharePct.toFixed(0)}% of the tariff). That is what the battery earns per cycled kWh — not the full tariff, as offers often claim.`,
            `— столько стоит кВт·ч, ОСТАВЛЕННЫЙ в батарее, а не проданный: ${buyback.spread.retailMdl.toFixed(2)} лей тариф − ${buyback.spread.buybackMdl.toFixed(2)} лей выкуп = ${buyback.spread.spreadMdl.toFixed(2)} лей (${buyback.spread.sharePct.toFixed(0)}% тарифа).`)}
        </span>
      </div>

      <div className="sp-yoy">
        {buyback.years.map((r) => (
          <div key={r.year}>
            <b>{r.avg.toFixed(2)} lei</b>
            <span>{r.year}{r.months < 12 ? ` · ${r.months} ${t3(lang, "luni", "mo", "мес")}` : ""}
              {r.yoyPct != null ? ` · ${r.yoyPct > 0 ? "+" : ""}${r.yoyPct.toFixed(0)}%` : ""}</span>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sp-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
        .sp-src{font-size:11px;color:var(--muted);text-align:right;max-width:38ch;line-height:1.4}
        .sp-src b{font-weight:700;color:var(--ink)}
        .sp-lead{font-size:12.5px;color:var(--muted);margin:6px 0 14px;max-width:72ch;line-height:1.55}
        .sp-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}
        .sp-m{background:var(--paper);border:1px solid var(--line);border-radius:11px;padding:11px 13px}
        .sp-m b{display:block;font-family:var(--font-d,inherit);font-size:18px;font-weight:700;letter-spacing:-.01em;
          font-variant-numeric:tabular-nums;color:var(--ink)}
        .sp-m.good b{color:var(--green)}
        .sp-m span{display:block;margin-top:2px;font-size:10.5px;color:var(--muted);line-height:1.35}
        .sp-spread{margin-top:14px;padding:12px 14px;background:var(--amber-tint);border-radius:10px;
          display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
        .sp-spread b{font-family:var(--font-d,inherit);font-size:20px;font-weight:700;color:#B4700F;
          letter-spacing:-.01em;flex:none}
        .sp-spread span{flex:1;min-width:240px;font-size:12px;color:var(--ink);line-height:1.55}
        .sp-yoy{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:12px}
        .sp-yoy > div{padding:9px 12px;border-left:2px solid var(--line)}
        .sp-yoy b{display:block;font-family:var(--font-d,inherit);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
        .sp-yoy span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
      ` }} />
    </section>
  );
}
