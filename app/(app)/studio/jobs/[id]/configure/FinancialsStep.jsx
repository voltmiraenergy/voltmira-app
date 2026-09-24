"use client";
// FinancialsStep.jsx — extracted out of WizardSteps.jsx. Grid Scheme and
// Payment Method are now two visually distinct cards instead of one flowing
// column, and a real SVG line chart plots the 25-year cumulative cash
// position — results.e.rows, the SAME array simulate() in _engine.js already
// returns for every other Studio surface, just drawn instead of only fed
// into the single payback number.
import { tx, EUR } from "../../../studio-kit.jsx";
import { amortizedMonthlyPayment } from "@voltmira/engine";
import SegmentedControl from "./SegmentedControl.jsx";
import Slider from "./Slider.jsx";

function CashFlowChart({ rows, payback, lang }) {
  const t = (o) => tx(o, lang);
  if (!rows || !rows.length) return null;
  const W = 560, H = 160, padL = 44, padR = 12, padT = 12, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = rows.length;
  const min = Math.min(0, ...rows), max = Math.max(0, ...rows);
  const span = max - min || 1;
  const x = (i) => padL + (i / (n - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - min) / span) * innerH;
  const path = rows.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0);
  const paybackX = payback != null ? x(Math.min(n - 1, Math.max(0, payback - 1))) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={t({ en: "25-year cumulative cash position", ro: "Poziția de numerar cumulată pe 25 de ani", ru: "Накопленный денежный поток за 25 лет" })}>
      {/* zero line */}
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} className="stroke-slate-300 dark:stroke-[#3A3A3A]" strokeWidth="1" strokeDasharray="3,3" />
      <text x={padL - 6} y={zeroY + 3} textAnchor="end" className="fill-slate-400 dark:fill-[#8A8A8A]" fontSize="9">€0</text>
      <text x={padL - 6} y={y(max) + 8} textAnchor="end" className="fill-slate-400 dark:fill-[#8A8A8A]" fontSize="9">{EUR(max)}</text>
      <text x={padL - 6} y={y(min) - 2} textAnchor="end" className="fill-slate-400 dark:fill-[#8A8A8A]" fontSize="9">{EUR(min)}</text>
      {/* x-axis year labels */}
      <text x={x(0)} y={H - 6} textAnchor="start" className="fill-slate-400 dark:fill-[#8A8A8A]" fontSize="9">{t({ en: "yr 1", ro: "an 1", ru: "год 1" })}</text>
      <text x={x(n - 1)} y={H - 6} textAnchor="end" className="fill-slate-400 dark:fill-[#8A8A8A]" fontSize="9">{t({ en: `yr ${n}`, ro: `an ${n}`, ru: `год ${n}` })}</text>
      {paybackX != null && (
        <line x1={paybackX} y1={padT} x2={paybackX} y2={H - padB} className="stroke-brand-400 dark:stroke-brand-400" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
      )}
      <path d={path} fill="none" className="stroke-brand-600 dark:stroke-brand-400" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {paybackX != null && <circle cx={paybackX} cy={zeroY} r="3" className="fill-brand-600 dark:fill-brand-400" />}
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">
          {t({ en: "Market / connection scheme", ro: "Piață / schemă de racordare", ru: "Рынок / схема подключения" })}
        </label>
        <SegmentedControl columns={2} value={job.market} onChange={(m) => patch({ market: m })} options={[
          { value: "MD", label: t({ en: "MD — Net-billing", ro: "MD — Facturare netă", ru: "MD — Нетто-биллинг" }) },
          { value: "RO", label: t({ en: "RO — Net-metering", ro: "RO — Măsurare netă", ru: "RO — Нетто-учёт" }) },
        ]} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">
          {t({ en: "Payment method", ro: "Metodă de plată", ru: "Способ оплаты" })}
        </label>
        <SegmentedControl columns={2} value={financing.type} onChange={(type) => patch({ financing: { ...financing, type } })} options={[
          { value: "cash", label: t({ en: "Cash", ro: "Numerar", ru: "Наличные" }) },
          { value: "credit", label: t({ en: "Green Credit", ro: "Credit Verde", ru: "Зелёный кредит" }) },
        ]} />

        {financing.type === "credit" && (
          <div className="mt-4 space-y-5 border-t border-slate-100 pt-4 dark:border-[#242424]">
            <Slider label={t({ en: "Term", ro: "Durată", ru: "Срок" })} value={financing.months} min={12} max={120} step={6}
              format={(v) => `${v} ${t({ en: "mo", ro: "luni", ru: "мес." })}`}
              onChange={(v) => patch({ financing: { ...financing, months: v } })} />
            <Slider label={t({ en: "Interest rate", ro: "Dobândă", ru: "Ставка" })} value={financing.ratePct} min={0} max={20} step={0.5}
              format={(v) => `${v}%`}
              onChange={(v) => patch({ financing: { ...financing, ratePct: v } })} />
            <div className="rounded-lg bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
              <div className="text-xs font-medium text-brand-700 dark:text-brand-300">{t({ en: "Estimated monthly payment", ro: "Rată lunară estimată", ru: "Ориентировочный ежемесячный платёж" })}</div>
              <div className="text-xl font-bold text-brand-900 dark:text-brand-200">{EUR(monthly)} <span className="text-sm font-normal">/ {t({ en: "mo", ro: "lună", ru: "мес" })}</span></div>
            </div>
          </div>
        )}
      </div>

      {rows && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">
            {t({ en: "25-year cash position (expected scenario)", ro: "Poziția de numerar pe 25 de ani (scenariu așteptat)", ru: "Денежный поток за 25 лет (ожидаемый сценарий)" })}
          </label>
          <CashFlowChart rows={rows} payback={payback} lang={lang} />
        </div>
      )}
    </div>
  );
}
