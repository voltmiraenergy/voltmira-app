"use client";
// EquipmentStep.jsx — extracted out of WizardSteps.jsx (matching the other
// steps' file pattern) and rebuilt from a card grid into real sortable
// tables, one per category, each wrapped in an Accordion. A checkbox per row
// (separate from the row-click-to-pick affordance) drives a real spec
// comparison panel once 2+ items in the same category are checked — no new
// data, every column and compared field comes straight off the shipped
// catalog (lib/supplierCatalog.js via PANELS/INVERTERS/BATTERIES).
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ArrowUpDown, PanelsTopLeft, Zap, BatteryFull, X } from "lucide-react";
import { tx, EUR, PANELS, INVERTERS, BATTERIES } from "../../../studio-kit.jsx";
import Accordion from "./Accordion.jsx";

function SortHeader({ label, active, dir, onClick, align }) {
  return (
    <th onClick={onClick}
      className={"cursor-pointer select-none py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:text-[#8A8A8A] dark:hover:text-[#D4D4D4] " +
        (align === "right" ? "text-right pr-1" : "pr-2")}>
      <span className={"inline-flex items-center gap-1 " + (align === "right" ? "flex-row-reverse" : "")}>
        {label}
        <ArrowUpDown className={"h-2.5 w-2.5 " + (active ? "text-brand-600 dark:text-brand-400" : "opacity-40")} />
      </span>
    </th>
  );
}

// One category's table: sortable columns, a pick-by-row-click, and a
// checkbox per row (own column, doesn't trigger the pick) feeding `compare`.
function CategoryTable({ items, columns, selectedId, onPick, invalid, compare, onToggleCompare }) {
  const [sort, setSort] = useState({ key: columns[0].key, dir: 1 });
  const sorted = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === "string") return av.localeCompare(bv) * sort.dir;
      return ((av ?? 0) - (bv ?? 0)) * sort.dir;
    });
    return list;
  }, [items, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  }

  return (
    <div className={"overflow-hidden rounded-lg border " + (invalid ? "border-red-300 dark:border-red-500/50" : "border-slate-200 dark:border-[#2C2C2C]")}>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-white dark:bg-[#1E1E1E]">
            <tr className="border-b border-slate-200 text-left dark:border-[#2C2C2C]">
              <th className="w-7 py-2 pl-2"></th>
              {columns.map((c) => (
                <SortHeader key={c.key} label={c.label} align={c.align}
                  active={sort.key === c.key} dir={sort.dir}
                  onClick={() => toggleSort(c.key)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const selected = item.id === selectedId;
              return (
                <tr key={item.id} onClick={() => onPick(item)}
                  className={"cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 dark:border-[#242424] " +
                    (selected ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-slate-50 dark:hover:bg-[#242424]/60")}>
                  <td className="py-2 pl-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={compare.has(item.id)} onChange={() => onToggleCompare(item.id)}
                      className="h-3.5 w-3.5 accent-brand-600" />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className={"py-2 " + (c.align === "right" ? "pr-1 text-right tabular-nums" : "pr-2") +
                      (c.key === columns[0].key ? " font-medium text-slate-900 dark:text-white" : " text-slate-600 dark:text-[#C4C4C4]")}>
                      {selected && c.key === columns[0].key && <CheckCircle2 className="mr-1 inline h-3 w-3 text-brand-600 dark:text-brand-400" />}
                      {c.format ? c.format(item[c.key], item) : item[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparePanel({ items, fields, onClose, onRemove, t }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-500/30 dark:bg-brand-500/5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-800 dark:text-brand-300">
          {t({ en: "Compare", ro: "Compară", ru: "Сравнить" })} ({items.length})
        </span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-[#8A8A8A] dark:hover:text-[#D4D4D4]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-28 py-1 text-left font-semibold text-slate-400 dark:text-[#8A8A8A]"> </th>
            {items.map((it) => (
              <th key={it.id} className="py-1 pr-3 text-left font-semibold text-slate-900 dark:text-white">
                <div className="flex items-center gap-1">
                  <span className="truncate">{it.brand} {it.model}</span>
                  <button type="button" onClick={() => onRemove(it.id)} className="flex-none text-slate-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className="border-t border-brand-100 dark:border-brand-500/20">
              <td className="py-1 pr-2 text-slate-500 dark:text-[#B0B0B0]">{f.label}</td>
              {items.map((it) => (
                <td key={it.id} className="py-1 pr-3 font-medium tabular-nums text-slate-800 dark:text-[#D4D4D4]">
                  {f.format ? f.format(it[f.key], it) : it[f.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EquipmentStep({ job, patch, derived, lang }) {
  const t = (o) => tx(o, lang);
  const noInverter = !job.inverterId;
  const noPanel = !job.panelId;
  const hasBattery = (+job.batteryKwh || 0) > 0 && !!job.batteryId;

  const [comparePanels, setComparePanels] = useState(() => new Set());
  const [compareInverters, setCompareInverters] = useState(() => new Set());
  const [compareBatteries, setCompareBatteries] = useState(() => new Set());

  function toggle(setFn) {
    return (id) => setFn((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function remove(setFn) {
    return (id) => setFn((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function pickBattery(b) {
    if (!b) { patch({ batteryId: null, batteryKwh: 0 }); return; }
    patch({ batteryId: b.id, batteryKwh: b.kwh });
  }

  const panelCols = [
    { key: "watt", label: t({ en: "Model", ro: "Model", ru: "Модель" }), format: (v, it) => `${it.brand} ${v}W` },
    { key: "voc", label: "Voc", align: "right", format: (v) => `${v}V` },
    { key: "eff", label: t({ en: "Eff.", ro: "Rand.", ru: "КПД" }), align: "right", format: (v) => `${v}%` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена" }), align: "right", format: (v) => EUR(v) },
  ];
  const inverterCols = [
    { key: "kw", label: t({ en: "Model", ro: "Model", ru: "Модель" }), format: (v, it) => `${it.brand} ${v}kW` },
    { key: "type", label: t({ en: "Type", ro: "Tip", ru: "Тип" }) },
    { key: "maxDcV", label: t({ en: "Max DC", ro: "DC max", ru: "Макс. DC" }), align: "right", format: (v) => `${v}V` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена" }), align: "right", format: (v) => EUR(v) },
  ];
  const batteryCols = [
    { key: "kwh", label: t({ en: "Model", ro: "Model", ru: "Модель" }), format: (v, it) => `${it.brand} ${v}kWh` },
    { key: "chem", label: t({ en: "Chemistry", ro: "Chimie", ru: "Химия" }) },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена" }), align: "right", format: (v) => EUR(v) },
  ];

  const panelCompareFields = [
    { key: "watt", label: "Watt", format: (v) => `${v}W` },
    { key: "voc", label: "Voc", format: (v) => `${v}V` },
    { key: "eff", label: t({ en: "Efficiency", ro: "Randament", ru: "КПД" }), format: (v) => `${v}%` },
    { key: "tempCoeff", label: t({ en: "Temp. coeff.", ro: "Coef. temp.", ru: "Темп. коэф." }), format: (v) => `${v}%/°C` },
    { key: "warrantyYears", label: t({ en: "Warranty", ro: "Garanție", ru: "Гарантия" }), format: (v) => `${v} ${t({ en: "yrs", ro: "ani", ru: "лет" })}` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена" }), format: (v) => EUR(v) },
  ];
  const inverterCompareFields = [
    { key: "kw", label: "kW", format: (v) => `${v}kW` },
    { key: "type", label: t({ en: "Type", ro: "Tip", ru: "Тип" }) },
    { key: "phases", label: t({ en: "Phases", ro: "Faze", ru: "Фазы" }) },
    { key: "maxDcV", label: t({ en: "Max DC voltage", ro: "Tensiune DC max", ru: "Макс. напряжение DC" }), format: (v) => `${v}V` },
    { key: "maxEfficiencyPct", label: t({ en: "Peak efficiency", ro: "Randament maxim", ru: "Пиковый КПД" }), format: (v) => (v == null ? "—" : `${v}%`) },
    { key: "warrantyYears", label: t({ en: "Warranty", ro: "Garanție", ru: "Гарантия" }), format: (v) => `${v} ${t({ en: "yrs", ro: "ani", ru: "лет" })}` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена" }), format: (v) => EUR(v) },
  ];
  const batteryCompareFields = [
    { key: "kwh", label: "kWh" },
    { key: "chem", label: t({ en: "Chemistry", ro: "Chimie", ru: "Химия" }) },
    { key: "cycles", label: t({ en: "Cycle life", ro: "Durată de viață", ru: "Ресурс циклов" }) },
    { key: "warrantyYears", label: t({ en: "Warranty", ro: "Garanție", ru: "Гарантия" }), format: (v) => `${v} ${t({ en: "yrs", ro: "ani", ru: "лет" })}` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена" }), format: (v) => EUR(v) },
  ];

  const comparedPanels = PANELS.filter((p) => comparePanels.has(p.id));
  const comparedInverters = INVERTERS.filter((i) => compareInverters.has(i.id));
  const comparedBatteries = BATTERIES.filter((b) => compareBatteries.has(b.id));

  return (
    <div className="space-y-6">
      <div className={"rounded-lg border p-3 " + (derived?.vocExceeds
        ? "border-accent-300 bg-accent-50 dark:border-accent-500/40 dark:bg-accent-500/10"
        : "border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10")}>
        <div className="flex items-center gap-2 text-xs font-semibold">
          {derived?.vocExceeds
            ? <><AlertTriangle className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" /><span className="text-accent-800 dark:text-accent-300">{t({ en: "String voltage exceeds inverter limit", ro: "Tensiunea șirului depășește limita invertorului", ru: "Напряжение цепочки выше предела инвертора" })}</span></>
            : <><CheckCircle2 className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" /><span className="text-brand-800 dark:text-brand-300">{t({ en: "String voltage OK", ro: "Tensiune șir OK", ru: "Напряжение цепочки в норме" })}</span></>}
        </div>
      </div>

      <Accordion title={t({ en: "Panels", ro: "Panouri", ru: "Панели" })} icon={PanelsTopLeft}>
        <CategoryTable items={PANELS} columns={panelCols} selectedId={job.panelId} invalid={noPanel}
          onPick={(p) => patch({ panelId: p.id })} compare={comparePanels} onToggleCompare={toggle(setComparePanels)} />
        {comparedPanels.length >= 2 && (
          <ComparePanel items={comparedPanels} fields={panelCompareFields} t={t}
            onClose={() => setComparePanels(new Set())} onRemove={remove(setComparePanels)} />
        )}
      </Accordion>

      <Accordion title={t({ en: "Inverter", ro: "Invertor", ru: "Инвертор" })} icon={Zap}>
        <CategoryTable items={INVERTERS} columns={inverterCols} selectedId={job.inverterId} invalid={noInverter}
          onPick={(inv) => patch({ inverterId: inv.id })} compare={compareInverters} onToggleCompare={toggle(setCompareInverters)} />
        {noInverter && (
          <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {t({ en: "Select an inverter to continue.", ro: "Selectează un invertor pentru a continua.", ru: "Выберите инвертор, чтобы продолжить." })}
          </p>
        )}
        {comparedInverters.length >= 2 && (
          <ComparePanel items={comparedInverters} fields={inverterCompareFields} t={t}
            onClose={() => setCompareInverters(new Set())} onRemove={remove(setCompareInverters)} />
        )}
      </Accordion>

      <Accordion title={t({ en: "Battery", ro: "Baterie", ru: "Батарея" })} icon={BatteryFull}>
        <button type="button" onClick={() => pickBattery(null)}
          className={"mb-2 w-full rounded-lg border p-2.5 text-left text-sm font-medium transition-colors " +
            (!hasBattery ? "ws-fill-brand-tint border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-300"
              : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-[#2C2C2C] dark:text-[#C4C4C4]")}>
          {t({ en: "No battery", ro: "Fără baterie", ru: "Без батареи" })}
        </button>
        <CategoryTable items={BATTERIES} columns={batteryCols} selectedId={hasBattery ? job.batteryId : null} invalid={false}
          onPick={pickBattery} compare={compareBatteries} onToggleCompare={toggle(setCompareBatteries)} />
        {comparedBatteries.length >= 2 && (
          <ComparePanel items={comparedBatteries} fields={batteryCompareFields} t={t}
            onClose={() => setCompareBatteries(new Set())} onRemove={remove(setCompareBatteries)} />
        )}
      </Accordion>
    </div>
  );
}
