"use client";
// LiveEngineSidebar.jsx — the right panel. Three real things: the 3-scenario
// payback (pessimistic/expected/optimistic — the same quote() every other
// Studio surface uses, with Expected given real visual weight and the other
// two de-emphasized rather than all three competing equally), a cost
// breakdown (real catalog unit prices for the picked panel/inverter/battery;
// the remainder is honestly labelled as installation/BOS/margin rather than
// a precise "labor" figure nothing here actually computes), and a real
// Voc-vs-inverter check — not a simulated one.
import { useState } from "react";
import {
  AlertTriangle, XCircle, PanelsTopLeft, Zap as InverterIcon,
  BatteryFull, Wrench, ShieldCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import { tx, EUR } from "../../../studio-kit.jsx";

function CostRow({ icon: Icon, iconClass, label, value }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-[#C4C4C4]">
        <span className={"flex h-6 w-6 flex-none items-center justify-center rounded-full " + iconClass}>
          <Icon className="h-3 w-3" />
        </span>
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{EUR(value)}</span>
    </div>
  );
}

// Bar length is proportional to payback length on a shared 0..max axis, so a
// LONGER bar plainly means a LONGER payback (never inverted to "longer =
// better") — the reading stays honest even before anyone looks at the number.
function PaybackBar({ label, value, unit, max, barClass }) {
  const pct = value == null ? 0 : Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-[70px] flex-none text-[10px] font-medium text-slate-400 dark:text-[#8A8A8A]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-[#242424]">
        {value != null && <div className={"h-full rounded-full " + barClass} style={{ width: pct + "%" }} />}
      </div>
      <span className="w-10 flex-none text-right text-[10px] font-semibold tabular-nums text-slate-500 dark:text-[#B0B0B0]">
        {value == null ? "—" : `${value.toFixed(1)}${unit}`}
      </span>
    </div>
  );
}

export default function LiveEngineSidebar({ job, derived, lang }) {
  const t = (o) => tx(o, lang);
  const [collapsed, setCollapsed] = useState(false);
  if (!derived) return null;
  const { sys, results, costEur, strings, vocExceeds } = derived;
  const yrs = t({ en: "yrs", ro: "ani", ru: "лет" });
  const noInverter = !job.inverterId;

  const modules = strings.modules;
  const panelCost = (sys.panel.price || 0) * modules;
  const inverterCost = sys.inverter.price || 0;
  const hasBattery = (+job.batteryKwh || 0) > 0 && !!job.batteryId;
  const batteryUnits = hasBattery ? Math.max(1, Math.round((+job.batteryKwh || 0) / (sys.battery.kwh || 1))) : 0;
  const batteryCost = hasBattery ? batteryUnits * (sys.battery.price || 0) : 0;
  const remainder = Math.max(0, costEur - panelCost - inverterCost - batteryCost);

  const paybackVals = [results.p?.payback, results.e?.payback, results.o?.payback].filter((v) => v != null);
  const maxPayback = paybackVals.length ? Math.max(...paybackVals) : 1;

  // Error (no inverter picked) beats the amber "exceeds limit" warning, which
  // beats the calm green "OK" — vocExceeds is structurally always false when
  // there's no inverter (it's checked against a not-yet-real default), so
  // without this the alert used to show a false-calm "OK" with nothing picked.
  const alertLevel = noInverter ? "error" : vocExceeds ? "warn" : "ok";
  const alertTone = {
    error: { border: "border-red-300 dark:border-red-500/40", bg: "bg-red-50 dark:bg-red-500/10", chip: "bg-red-100 dark:bg-red-500/20", text: "text-red-800 dark:text-red-300", icon: "text-red-600 dark:text-red-400" },
    warn: { border: "border-accent-300 dark:border-accent-500/40", bg: "bg-accent-50 dark:bg-accent-500/10", chip: "bg-accent-100 dark:bg-accent-500/20", text: "text-accent-800 dark:text-accent-300", icon: "text-accent-600 dark:text-accent-400" },
    ok: { border: "border-brand-200 dark:border-brand-500/30", bg: "bg-brand-50 dark:bg-brand-500/10", chip: "bg-brand-100 dark:bg-brand-500/20", text: "text-brand-800 dark:text-brand-300", icon: "text-brand-600 dark:text-brand-400" },
  }[alertLevel];

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
        <button type="button" onClick={() => setCollapsed(false)}
          className="ws-fill-brand-tint flex h-8 w-8 items-center justify-center rounded-full text-brand-700 dark:text-brand-300"
          title={t({ en: "Expand", ro: "Expandează", ru: "Развернуть" })}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <span>{results.e?.payback == null ? "—" : results.e.payback.toFixed(0)}</span>
          <span className="text-[8px] font-semibold uppercase leading-none">{yrs}</span>
        </div>
        <div className={"flex h-8 w-8 flex-none items-center justify-center rounded-full " + alertTone.chip}>
          {alertLevel === "error" ? <XCircle className={"h-4 w-4 " + alertTone.icon} />
            : alertLevel === "warn" ? <AlertTriangle className={"h-4 w-4 " + alertTone.icon} />
            : <ShieldCheck className={"h-4 w-4 " + alertTone.icon} />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payback: Expected is the hero number; Pessimistic/Optimistic flank it, smaller */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#B0B0B0]">
            {t({ en: "3-scenario payback", ro: "Amortizare pe 3 scenarii", ru: "Окупаемость по 3 сценариям" })}
          </h3>
          <button type="button" onClick={() => setCollapsed(true)}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-[#8A8A8A] dark:hover:bg-[#242424] dark:hover:text-[#D4D4D4]"
            title={t({ en: "Collapse", ro: "Restrânge", ru: "Свернуть" })}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mb-4 rounded-xl bg-brand-50 py-4 text-center dark:bg-brand-500/10">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            {t({ en: "Expected", ro: "Așteptat", ru: "Ожидаемо" })}
          </div>
          <div className="mt-0.5 text-4xl font-bold tracking-tight text-brand-800 dark:text-brand-200">
            {results.e?.payback == null ? "—" : results.e.payback.toFixed(1)}
            <span className="ml-1.5 text-base font-semibold text-brand-500 dark:text-brand-400">{yrs}</span>
          </div>
        </div>
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 dark:bg-[#242424]/50">
          <PaybackBar label={t({ en: "Pessimistic", ro: "Pesimist", ru: "Пессимистично" })} unit={yrs}
            value={results.p?.payback} max={maxPayback} barClass="bg-accent-500 dark:bg-accent-400" />
          <PaybackBar label={t({ en: "Expected", ro: "Așteptat", ru: "Ожидаемо" })} unit={yrs}
            value={results.e?.payback} max={maxPayback} barClass="bg-brand-600 dark:bg-brand-400" />
          <PaybackBar label={t({ en: "Optimistic", ro: "Optimist", ru: "Оптимистично" })} unit={yrs}
            value={results.o?.payback} max={maxPayback} barClass="bg-brand-300 dark:bg-brand-300/70" />
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#B0B0B0]">
          {t({ en: "Cost breakdown", ro: "Structura costului", ru: "Структура стоимости" })}
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-[#242424]">
          <CostRow icon={PanelsTopLeft} iconClass="bg-slate-100 text-slate-500 dark:bg-[#242424] dark:text-[#B0B0B0]"
            label={t({ en: `Panels × ${modules}`, ro: `Panouri × ${modules}`, ru: `Панели × ${modules}` })} value={panelCost} />
          <CostRow icon={InverterIcon} iconClass="bg-slate-100 text-slate-500 dark:bg-[#242424] dark:text-[#B0B0B0]"
            label={t({ en: "Inverter", ro: "Invertor", ru: "Инвертор" })} value={inverterCost} />
          {hasBattery && (
            <CostRow icon={BatteryFull} iconClass="bg-slate-100 text-slate-500 dark:bg-[#242424] dark:text-[#B0B0B0]"
              label={t({ en: `Battery × ${batteryUnits}`, ro: `Baterie × ${batteryUnits}`, ru: `Батарея × ${batteryUnits}` })} value={batteryCost} />
          )}
          <CostRow icon={Wrench} iconClass="bg-slate-100 text-slate-500 dark:bg-[#242424] dark:text-[#B0B0B0]"
            label={t({ en: "Install, BOS & margin (est.)", ro: "Montaj, BOS & marjă (est.)", ru: "Монтаж, BOS и маржа (оценка)" })} value={remainder} />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-[#2C2C2C]">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{t({ en: "Total", ro: "Total", ru: "Итого" })}</span>
          <span className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{EUR(costEur)}</span>
        </div>
      </div>

      {/* Validation alert — "no inverter" is a real error, not a silent green OK */}
      <div className={"rounded-2xl border p-4 shadow-sm " + alertTone.border + " " + alertTone.bg}>
        <div className="flex items-start gap-3">
          <span className={"flex h-8 w-8 flex-none items-center justify-center rounded-full " + alertTone.chip}>
            {alertLevel === "error" ? <XCircle className={"h-4 w-4 " + alertTone.icon} />
              : alertLevel === "warn" ? <AlertTriangle className={"h-4 w-4 " + alertTone.icon} />
              : <ShieldCheck className={"h-4 w-4 " + alertTone.icon} />}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-[#8A8A8A]">
              {t({ en: "Live validation", ro: "Validare live", ru: "Проверка вживую" })}
            </div>
            <div className={"text-sm font-semibold " + alertTone.text}>
              {alertLevel === "error"
                ? t({ en: "No inverter selected yet", ro: "Niciun invertor selectat încă", ru: "Инвертор пока не выбран" })
                : alertLevel === "warn"
                ? t({ en: "String voltage exceeds inverter limit", ro: "Tensiunea șirului depășește limita invertorului", ru: "Напряжение цепочки выше предела инвертора" })
                : t({ en: "String voltage OK", ro: "Tensiune șir OK", ru: "Напряжение цепочки в норме" })}
            </div>
            {!noInverter && (
              <div className="mt-0.5 text-xs text-slate-600 dark:text-[#B0B0B0]">
                {`${strings.perString} × ${sys.panel.voc} V ≈ ${Math.round(strings.vocCold)} V (−10°C) `}
                {vocExceeds ? `> ${sys.inverter.maxDcV} V` : `≤ ${sys.inverter.maxDcV} V`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
