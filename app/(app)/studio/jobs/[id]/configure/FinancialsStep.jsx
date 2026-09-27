"use client";
// FinancialsStep.jsx — the grid scheme, how the client pays (with the monthly
// instalment when it's a credit), and the 25-year cumulative cash position:
// results.e.rows, the same series simulate() in _engine.js returns for every
// other Studio surface, drawn instead of only feeding the payback number.
import { Landmark, Wallet, LineChart } from "lucide-react";
import { tx, EUR } from "../../../studio-kit.jsx";
import { amortizedMonthlyPayment } from "@voltmira/engine";
import SegmentedControl from "./SegmentedControl.jsx";
import Slider from "./Slider.jsx";

function CashFlowChart({ rows, payback, lang }) {
  const t = (o) => tx(o, lang);
  if (!rows || !rows.length) return null;
  const W = 600, H = 190, padL = 56, padR = 14, padT = 18, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = rows.length;
  const min = Math.min(0, ...rows), max = Math.max(0, ...rows);
  const span = max - min || 1;
  const x = (i) => padL + (i / (n - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - min) / span) * innerH;
  const path = rows.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const zeroY = y(0);
  const pbX = payback != null && payback <= n ? x(Math.min(n - 1, Math.max(0, payback - 1))) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ws-chart" role="img"
      aria-label={t({ en: "Cumulative cash position over 25 years", ro: "Poziția de numerar cumulată pe 25 de ani", ru: "Накопленный денежный поток за 25 лет" })}>
      <path d={area} className="area" />
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} className="zero" strokeWidth="1" strokeDasharray="3 3" />
      <text x={padL - 8} y={y(max) + 4} textAnchor="end" className="tick">{EUR(max)}</text>
      <text x={padL - 8} y={zeroY + 4} textAnchor="end" className="tick">€0</text>
      {min < 0 && <text x={padL - 8} y={y(min) + 4} textAnchor="end" className="tick">{EUR(min)}</text>}
      <text x={x(0)} y={H - 6} textAnchor="start" className="tick">{t({ en: "year 1", ro: "anul 1", ru: "год 1" })}</text>
      <text x={x(n - 1)} y={H - 6} textAnchor="end" className="tick">{t({ en: `year ${n}`, ro: `anul ${n}`, ru: `год ${n}` })}</text>
      {pbX != null && (
        <>
          <line x1={pbX} y1={padT} x2={pbX} y2={H - padB} className="guide" strokeWidth="1" strokeDasharray="2 3" />
          <circle cx={pbX} cy={zeroY} r="4" className="mark" />
          <text x={pbX + (pbX > W - 140 ? -8 : 8)} y={padT + 10} textAnchor={pbX > W - 140 ? "end" : "start"} className="mlabel">
            {t({ en: `pays back in year ${Math.ceil(payback)}`, ro: `se amortizează în anul ${Math.ceil(payback)}`, ru: `окупается на ${Math.ceil(payback)}-й год` })}
          </text>
        </>
      )}
      <path d={path} fill="none" className="line" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function FinancialsStep({ job, patch, derived, lang }) {
  const t = (o) => tx(o, lang);
  const financing = job.financing || { type: "cash", months: 60, ratePct: 9 };
  const monthly = financing.type === "credit"
    ? amortizedMonthlyPayment(derived?.costEur || 0, financing.ratePct, financing.months / 12)
    : 0;
  const rows = derived?.results?.e?.rows;
  const payback = derived?.results?.e?.payback;
  const mo = t({ en: "mo", ro: "luni", ru: "мес." });

  return (
    <>
      <div className="ws-cols">
        <div className="ws-sec">
          <div className="ws-sec-h"><Landmark size={16} aria-hidden="true" />{t({ en: "Grid scheme", ro: "Schema de racordare", ru: "Схема подключения" })}</div>
          <SegmentedControl full value={job.market} onChange={(m) => patch({ market: m })} label={t({ en: "Grid scheme", ro: "Schema de racordare", ru: "Схема подключения" })} options={[
            { value: "MD", label: t({ en: "Moldova, net billing", ro: "Moldova, facturare netă", ru: "Молдова, нетто-биллинг" }) },
            { value: "RO", label: t({ en: "Romania, net metering", ro: "România, compensare", ru: "Румыния, нетто-учёт" }) },
          ]} />
        </div>
        <div className="ws-sec">
          <div className="ws-sec-h"><Wallet size={16} aria-hidden="true" />{t({ en: "How the client pays", ro: "Cum plătește clientul", ru: "Как платит клиент" })}</div>
          {/* Nothing is pre-selected until the installer actually chooses: the
              step only counts as done once job.financing exists. */}
          <SegmentedControl full value={job.financing?.type} onChange={(type) => patch({ financing: { ...financing, type } })} label={t({ en: "Payment method", ro: "Metodă de plată", ru: "Способ оплаты" })} options={[
            { value: "cash", label: t({ en: "Cash", ro: "Cash", ru: "Наличные" }) },
            { value: "credit", label: t({ en: "Green credit", ro: "Credit verde", ru: "Зелёный кредит" }) },
          ]} />
        </div>
      </div>

      {job.financing?.type === "credit" && (
        <div className="ws-box">
          <Slider id="ws-term" label={t({ en: "Term", ro: "Durată", ru: "Срок" })} value={financing.months} min={12} max={120} step={6}
            format={(v) => `${v} ${mo}`}
            onChange={(v) => patch({ financing: { ...financing, months: v } })} />
          <Slider id="ws-rate" label={t({ en: "Interest rate", ro: "Dobândă", ru: "Ставка" })} value={financing.ratePct} min={0} max={20} step={0.5}
            format={(v) => `${v}%`}
            onChange={(v) => patch({ financing: { ...financing, ratePct: v } })} />
          <div className="ws-callout">
            <span>{t({ en: "Monthly instalment, estimated", ro: "Rată lunară, estimată", ru: "Ежемесячный платёж, оценка" })}</span>
            <b>{EUR(monthly)}<small>/ {t({ en: "month", ro: "lună", ru: "мес." })}</small></b>
          </div>
        </div>
      )}

      {rows && (
        <div className="ws-sec">
          <div className="ws-sec-h"><LineChart size={16} aria-hidden="true" />{t({ en: "Cash position over 25 years, expected case", ro: "Poziția de numerar pe 25 de ani, scenariul așteptat", ru: "Денежный поток за 25 лет, ожидаемый сценарий" })}</div>
          <p className="ws-sec-note">{t({ en: "Money in the client's pocket, year by year, after paying for the system. Where the line crosses zero, it has paid for itself.", ro: "Banii rămași clientului, an de an, după plata sistemului. Unde linia trece de zero, sistemul s-a plătit singur.", ru: "Деньги клиента год за годом после оплаты системы. Где линия пересекает ноль, система окупилась." })}</p>
          <div className="ws-box" style={{ padding: "14px 12px 8px" }}>
            <CashFlowChart rows={rows} payback={payback} lang={lang} />
          </div>
        </div>
      )}
    </>
  );
}
