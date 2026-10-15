"use client";
// EquipmentStep.jsx — panels, inverter and battery, one sortable table per
// category, each in an Accordion that names the part currently picked. Click
// a row to pick it; tick two or more to compare them side by side. Every
// column comes straight off the supplier catalog (lib/supplierCatalog.js via
// PANELS/INVERTERS/BATTERIES).
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle, ArrowUpDown, PanelsTopLeft, Zap, BatteryFull, X } from "lucide-react";
import { tx, PANELS, INVERTERS, BATTERIES, useFmt } from "../../../studio-kit.jsx";
import Accordion from "./Accordion.jsx";

function SortHeader({ label, active, dir, onClick, align }) {
  return (
    <th className={align === "right" ? "r" : ""} aria-sort={active ? (dir > 0 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={onClick} className={active ? "on" : ""}>
        {label}
        <ArrowUpDown size={10} aria-hidden="true" style={{ opacity: active ? 1 : 0.45 }} />
      </button>
    </th>
  );
}

const SR = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };

// One category's table: sortable columns, pick a part by clicking its row,
// and a checkbox per row (its own column, not a pick) feeding `compare`.
function CategoryTable({ items, columns, selectedId, onPick, invalid, compare, onToggleCompare, compareLabel }) {
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
    <div className={"ws-tbl-wrap" + (invalid ? " invalid" : "")}>
      <table className="ws-tbl">
        <thead>
          <tr>
            <th className="cb"><span style={SR}>{compareLabel}</span></th>
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
              <tr key={item.id} onClick={() => onPick(item)} className={selected ? "sel" : ""} aria-selected={selected}>
                <td className="cb" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={compare.has(item.id)} onChange={() => onToggleCompare(item.id)} aria-label={compareLabel} />
                </td>
                {columns.map((c, ci) => (
                  <td key={c.key} className={(c.align === "right" ? "r" : "") + (ci === 0 ? " name" : "")}>
                    {selected && ci === 0 && <CheckCircle2 size={14} aria-hidden="true" />}
                    {c.format ? c.format(item[c.key], item) : item[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparePanel({ items, fields, onClose, onRemove, t }) {
  return (
    <div className="ws-compare">
      <div className="ws-compare-top">
        <span>{t({ en: "Side by side", ro: "Comparație", ru: "Сравнение", uk: "Порівняння" })} ({items.length})</span>
        <button type="button" className="ws-x" onClick={onClose} aria-label={t({ en: "Close", ro: "Închide", ru: "Закрыть", uk: "Закрити" })}><X size={14} /></button>
      </div>
      <table>
        <thead>
          <tr>
            <th />
            {items.map((it) => (
              <th key={it.id}>
                <div>
                  <span>{it.brand} {it.model}</span>
                  <button type="button" className="ws-x" onClick={() => onRemove(it.id)} aria-label={t({ en: "Remove", ro: "Scoate", ru: "Убрать", uk: "Прибрати" })}><X size={12} /></button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key}>
              <td>{f.label}</td>
              {items.map((it) => <td key={it.id}>{f.format ? f.format(it[f.key], it) : it[f.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EquipmentStep({ job, patch, derived, lang }) {
  const { EUR } = useFmt();
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
    { key: "watt", label: t({ en: "Model", ro: "Model", ru: "Модель", uk: "Модель" }), format: (v, it) => `${it.brand} ${v}W` },
    { key: "voc", label: "Voc", align: "right", format: (v) => `${v}V` },
    { key: "eff", label: t({ en: "Eff.", ro: "Rand.", ru: "КПД", uk: "ККД" }), align: "right", format: (v) => `${v}%` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена", uk: "Ціна" }), align: "right", format: (v) => EUR(v) },
  ];
  const inverterCols = [
    { key: "kw", label: t({ en: "Model", ro: "Model", ru: "Модель", uk: "Модель" }), format: (v, it) => `${it.brand} ${v}kW` },
    { key: "type", label: t({ en: "Type", ro: "Tip", ru: "Тип", uk: "Тип" }) },
    { key: "maxDcV", label: t({ en: "Max DC", ro: "DC max", ru: "Макс. DC", uk: "Макс. DC" }), align: "right", format: (v) => `${v}V` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена", uk: "Ціна" }), align: "right", format: (v) => EUR(v) },
  ];
  const batteryCols = [
    { key: "kwh", label: t({ en: "Model", ro: "Model", ru: "Модель", uk: "Модель" }), format: (v, it) => `${it.brand} ${v}kWh` },
    { key: "chem", label: t({ en: "Chemistry", ro: "Chimie", ru: "Химия", uk: "Хімія" }) },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена", uk: "Ціна" }), align: "right", format: (v) => EUR(v) },
  ];

  const panelCompareFields = [
    { key: "watt", label: "Watt", format: (v) => `${v}W` },
    { key: "voc", label: "Voc", format: (v) => `${v}V` },
    { key: "eff", label: t({ en: "Efficiency", ro: "Randament", ru: "КПД", uk: "ККД" }), format: (v) => `${v}%` },
    { key: "tempCoeff", label: t({ en: "Temp. coeff.", ro: "Coef. temp.", ru: "Темп. коэф.", uk: "Темп. коеф." }), format: (v) => `${v}%/°C` },
    { key: "warrantyYears", label: t({ en: "Warranty", ro: "Garanție", ru: "Гарантия", uk: "Гарантія" }), format: (v) => `${v} ${t({ en: "yrs", ro: "ani", ru: "лет", uk: "р." })}` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена", uk: "Ціна" }), format: (v) => EUR(v) },
  ];
  const inverterCompareFields = [
    { key: "kw", label: "kW", format: (v) => `${v}kW` },
    { key: "type", label: t({ en: "Type", ro: "Tip", ru: "Тип", uk: "Тип" }) },
    { key: "phases", label: t({ en: "Phases", ro: "Faze", ru: "Фазы", uk: "Фази" }) },
    { key: "maxDcV", label: t({ en: "Max DC voltage", ro: "Tensiune DC max", ru: "Макс. напряжение DC", uk: "Макс. напруга DC" }), format: (v) => `${v}V` },
    { key: "maxEfficiencyPct", label: t({ en: "Peak efficiency", ro: "Randament maxim", ru: "Пиковый КПД", uk: "Піковий ККД" }), format: (v) => (v == null ? "—" : `${v}%`) },
    { key: "warrantyYears", label: t({ en: "Warranty", ro: "Garanție", ru: "Гарантия", uk: "Гарантія" }), format: (v) => `${v} ${t({ en: "yrs", ro: "ani", ru: "лет", uk: "р." })}` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена", uk: "Ціна" }), format: (v) => EUR(v) },
  ];
  const batteryCompareFields = [
    { key: "kwh", label: "kWh" },
    { key: "chem", label: t({ en: "Chemistry", ro: "Chimie", ru: "Химия", uk: "Хімія" }) },
    { key: "cycles", label: t({ en: "Cycle life", ro: "Durată de viață", ru: "Ресурс циклов", uk: "Ресурс циклів" }) },
    { key: "warrantyYears", label: t({ en: "Warranty", ro: "Garanție", ru: "Гарантия", uk: "Гарантія" }), format: (v) => `${v} ${t({ en: "yrs", ro: "ani", ru: "лет", uk: "р." })}` },
    { key: "price", label: t({ en: "Price", ro: "Preț", ru: "Цена", uk: "Ціна" }), format: (v) => EUR(v) },
  ];

  const comparedPanels = PANELS.filter((p) => comparePanels.has(p.id));
  const comparedInverters = INVERTERS.filter((i) => compareInverters.has(i.id));
  const comparedBatteries = BATTERIES.filter((b) => compareBatteries.has(b.id));

  const compareLabel = t({ en: "Compare", ro: "Compară", ru: "Сравнить", uk: "Порівняти" });
  const sys = derived?.sys;
  return (
    <>
      {noInverter ? (
        <div className="ws-note err"><XCircle size={16} aria-hidden="true" /><div><b>{t({ en: "No inverter chosen yet.", ro: "Niciun invertor ales încă.", ru: "Инвертор ещё не выбран.", uk: "Інвертор ще не вибрано." })}</b> {t({ en: "Pick one below; the string-voltage check and the annex need it.", ro: "Alege unul mai jos; verificarea tensiunii și anexa au nevoie de el.", ru: "Выберите ниже; он нужен для проверки напряжения и приложения.", uk: "Виберіть нижче; він потрібен для перевірки напруги та додатка." })}</div></div>
      ) : derived?.vocExceeds ? (
        <div className="ws-note warn"><AlertTriangle size={16} aria-hidden="true" /><div><b>{t({ en: "String voltage is above this inverter's limit.", ro: "Tensiunea șirului depășește limita invertorului.", ru: "Напряжение цепочки выше предела инвертора.", uk: "Напруга стрінга перевищує межу інвертора." })}</b> {t({ en: "Choose an inverter with a higher DC input, or fewer panels per string.", ro: "Alege un invertor cu intrare DC mai mare sau mai puține panouri pe șir.", ru: "Выберите инвертор с большим DC-входом или меньше панелей в цепочке.", uk: "Виберіть інвертор із більшим DC-входом або менше панелей у стрінгу." })}</div></div>
      ) : (
        <div className="ws-note ok"><CheckCircle2 size={16} aria-hidden="true" /><div><b>{t({ en: "These parts work together.", ro: "Aceste componente merg împreună.", ru: "Эти компоненты совместимы.", uk: "Ці компоненти сумісні." })}</b> {t({ en: "String voltage is within the inverter's limit.", ro: "Tensiunea șirului e în limita invertorului.", ru: "Напряжение цепочки в пределах инвертора.", uk: "Напруга стрінга в межах інвертора." })}</div></div>
      )}

      <Accordion title={t({ en: "Panels", ro: "Panouri", ru: "Панели", uk: "Панелі" })} icon={PanelsTopLeft}
        aside={!noPanel && sys ? `${sys.panel.brand} ${sys.panel.watt} W` : ""}>
        <CategoryTable items={PANELS} columns={panelCols} selectedId={job.panelId} invalid={noPanel} compareLabel={compareLabel}
          onPick={(p) => patch({ panelId: p.id })} compare={comparePanels} onToggleCompare={toggle(setComparePanels)} />
        {comparedPanels.length >= 2 && (
          <ComparePanel items={comparedPanels} fields={panelCompareFields} t={t}
            onClose={() => setComparePanels(new Set())} onRemove={remove(setComparePanels)} />
        )}
      </Accordion>

      <Accordion title={t({ en: "Inverter", ro: "Invertor", ru: "Инвертор", uk: "Інвертор" })} icon={Zap}
        aside={!noInverter && sys ? `${sys.inverter.brand} ${sys.inverter.kw} kW` : ""}>
        <CategoryTable items={INVERTERS} columns={inverterCols} selectedId={job.inverterId} invalid={noInverter} compareLabel={compareLabel}
          onPick={(inv) => patch({ inverterId: inv.id })} compare={compareInverters} onToggleCompare={toggle(setCompareInverters)} />
        {comparedInverters.length >= 2 && (
          <ComparePanel items={comparedInverters} fields={inverterCompareFields} t={t}
            onClose={() => setCompareInverters(new Set())} onRemove={remove(setCompareInverters)} />
        )}
      </Accordion>

      <Accordion title={t({ en: "Battery", ro: "Baterie", ru: "Батарея", uk: "Батарея" })} icon={BatteryFull}
        aside={hasBattery && sys ? `${sys.battery.brand} ${job.batteryKwh} kWh` : t({ en: "None", ro: "Fără", ru: "Нет", uk: "Немає" })}>
        <button type="button" onClick={() => pickBattery(null)} className={"ws-choice" + (!hasBattery ? " on" : "")}>
          {t({ en: "No battery", ro: "Fără baterie", ru: "Без батареи", uk: "Без батареї" })}
        </button>
        <CategoryTable items={BATTERIES} columns={batteryCols} selectedId={hasBattery ? job.batteryId : null} invalid={false} compareLabel={compareLabel}
          onPick={pickBattery} compare={compareBatteries} onToggleCompare={toggle(setCompareBatteries)} />
        {comparedBatteries.length >= 2 && (
          <ComparePanel items={comparedBatteries} fields={batteryCompareFields} t={t}
            onClose={() => setCompareBatteries(new Set())} onRemove={remove(setCompareBatteries)} />
        )}
      </Accordion>
    </>
  );
}
