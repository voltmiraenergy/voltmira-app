"use client";
// WorkspaceHeader.jsx — the always-on ticker. Four numbers, all real: system
// size and BOM cost come straight off the job + catalog, annual production
// and payback come out of the same engine quote() every other Studio surface
// uses (bankability, payments) — this never shows a number the rest of
// Studio would disagree with.
import { Zap, Sun, Euro, Clock3 } from "lucide-react";
import { tx, EUR, NUM } from "../../../studio-kit.jsx";

function Metric({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:border-r sm:border-slate-200 sm:dark:border-[#2C2C2C] last:border-r-0">
      <span className={"flex h-9 w-9 flex-none items-center justify-center rounded-lg " + accent}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-[#B0B0B0]">{label}</div>
        <div className="truncate text-base font-semibold text-slate-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

export default function WorkspaceHeader({ job, derived, lang }) {
  const t = (o) => tx(o, lang);
  const payback = derived?.results?.e?.payback;

  return (
    <div className="sticky top-0 z-10 rounded-t-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]/95">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 dark:border-[#242424]">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{job.name || "—"}</div>
        <div className="text-xs text-slate-500 dark:text-[#B0B0B0]">{String(job.address || "").split(",")[0]}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        <Metric icon={Zap} accent="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
          label={t({ en: "System size", ro: "Putere sistem", ru: "Мощность" })}
          value={`${(+job.kw || 0).toFixed(1)} kWp`} />
        <Metric icon={Sun} accent="bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400"
          label={t({ en: "Est. annual production", ro: "Producție anuală est.", ru: "Прогноз выработки/год" })}
          value={`${NUM(derived?.annualKwh || 0)} kWh`} />
        <Metric icon={Euro} accent="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
          label={t({ en: "Total BOM cost", ro: "Cost total (BOM)", ru: "Стоимость (BOM)" })}
          value={EUR(derived?.costEur || 0)} />
        <Metric icon={Clock3} accent="bg-slate-100 text-slate-600 dark:bg-[#2C2C2C]/40 dark:text-[#C4C4C4]"
          label={t({ en: "Payback period", ro: "Perioadă de amortizare", ru: "Срок окупаемости" })}
          value={payback == null ? "—" : `${payback.toFixed(1)} ${t({ en: "yrs", ro: "ani", ru: "лет" })}`} />
      </div>
    </div>
  );
}
