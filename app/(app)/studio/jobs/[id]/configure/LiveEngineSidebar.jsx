"use client";
// LiveEngineSidebar.jsx — the job's numbers beside whatever step is open,
// recomputed on every change: the expected payback (with the pessimistic and
// optimistic bands drawn on one axis, so a longer bar always means a longer
// payback), the system's key figures, where the money goes (real catalog
// prices for the picked equipment; the remainder is honestly labelled as
// installation, balance of system and margin), and a real string-voltage
// check against the chosen inverter.
import { AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { tx, EUR, NUM } from "../../../studio-kit.jsx";

export default function LiveEngineSidebar({ job, derived, lang }) {
  const t = (o) => tx(o, lang);
  if (!derived) return null;
  const { sys, results, costEur, strings, vocExceeds, annualKwh } = derived;
  const yrs = t({ en: "yrs", ro: "ani", ru: "лет", uk: "р." });
  const noInverter = !job.inverterId;

  const modules = strings.modules;
  const panelCost = (sys.panel.price || 0) * modules;
  const inverterCost = sys.inverter.price || 0;
  const hasBattery = (+job.batteryKwh || 0) > 0 && !!job.batteryId;
  const batteryUnits = hasBattery ? Math.max(1, Math.round((+job.batteryKwh || 0) / (sys.battery.kwh || 1))) : 0;
  const batteryCost = hasBattery ? batteryUnits * (sys.battery.price || 0) : 0;
  const remainder = Math.max(0, costEur - panelCost - inverterCost - batteryCost);
  const share = (v) => (costEur > 0 ? Math.max(1.5, (v / costEur) * 100) : 0);

  const bands = [
    ["p", t({ en: "Pessimistic", ro: "Pesimist", ru: "Пессимист.", uk: "Песиміст." }), "var(--amber)"],
    ["e", t({ en: "Expected", ro: "Așteptat", ru: "Ожидаемо", uk: "Очікувано" }), "var(--green)"],
    ["o", t({ en: "Optimistic", ro: "Optimist", ru: "Оптимист.", uk: "Оптиміст." }), "color-mix(in srgb, var(--green) 45%, var(--line))"],
  ];
  const vals = bands.map(([k]) => results[k]?.payback).filter((v) => v != null);
  const max = vals.length ? Math.max(...vals) : 1;
  const exp = results.e?.payback;
  const savings = results.e?.year1;

  // No inverter is a real error, not a calm "OK": vocExceeds can't be true
  // without one, so without this the check would read as passed.
  const level = noInverter ? "err" : vocExceeds ? "warn" : "ok";
  const StatusIcon = level === "err" ? XCircle : level === "warn" ? AlertTriangle : ShieldCheck;

  return (
    <aside className="ws-side" aria-label={t({ en: "Live numbers", ro: "Cifre live", ru: "Живые цифры", uk: "Живі цифри" })}>
      <section className="ws-card">
        <h3>{t({ en: "Live numbers", ro: "Cifre live", ru: "Живые цифры", uk: "Живі цифри" })}</h3>
        <p>{t({ en: "Recomputed from this job each time you change it.", ro: "Recalculate din lucrare la fiecare modificare.", ru: "Пересчитываются при каждом изменении объекта.", uk: "Перераховуються за кожної зміни об’єкта." })}</p>
        <div className="ws-hero">
          <span>{t({ en: "Payback, expected", ro: "Amortizare, așteptată", ru: "Окупаемость, ожидаемая", uk: "Окупність, очікувана" })}</span>
          <b>{exp == null ? "—" : exp.toFixed(1)}<small>{yrs}</small></b>
        </div>
        <div className="ws-bands">
          {bands.map(([k, label, c]) => {
            const v = results[k]?.payback;
            return (
              <div key={k} className="ws-band" style={{ "--c": c }}>
                <span>{label}</span>
                <i aria-hidden="true">{v != null && <s style={{ width: Math.max(4, Math.min(100, (v / max) * 100)) + "%" }} />}</i>
                <b>{v == null ? "—" : `${v.toFixed(1)} ${yrs}`}</b>
              </div>
            );
          })}
        </div>
        <div className="ws-facts">
          <div><span>{t({ en: "System", ro: "Sistem", ru: "Система", uk: "Система" })}</span><b>{(+job.kw || 0).toFixed(1)} kWp{hasBattery ? ` + ${job.batteryKwh} kWh` : ""}</b></div>
          <div><span>{t({ en: "Production a year", ro: "Producție pe an", ru: "Выработка в год", uk: "Генерація за рік" })}</span><b>{NUM(annualKwh || 0)} kWh</b></div>
          <div><span>{t({ en: "Savings, first year", ro: "Economie, primul an", ru: "Экономия, первый год", uk: "Економія, перший рік" })}</span><b>{savings == null ? "—" : EUR(savings)}</b></div>
        </div>
      </section>

      <section className="ws-card">
        <h3>{t({ en: "Where the money goes", ro: "Unde merg banii", ru: "Куда идут деньги", uk: "Куди йдуть гроші" })}</h3>
        <div className="ws-cost">
          <div><span>{t({ en: `Panels × ${modules}`, ro: `Panouri × ${modules}`, ru: `Панели × ${modules}`, uk: `Панелі × ${modules}` })}</span><b>{EUR(panelCost)}</b><i aria-hidden="true"><s style={{ width: share(panelCost) + "%" }} /></i></div>
          <div><span>{t({ en: "Inverter", ro: "Invertor", ru: "Инвертор", uk: "Інвертор" })}</span><b>{EUR(inverterCost)}</b><i aria-hidden="true"><s style={{ width: share(inverterCost) + "%" }} /></i></div>
          {hasBattery && (
            <div><span>{t({ en: `Battery × ${batteryUnits}`, ro: `Baterie × ${batteryUnits}`, ru: `Батарея × ${batteryUnits}`, uk: `Батарея × ${batteryUnits}` })}</span><b>{EUR(batteryCost)}</b><i aria-hidden="true"><s style={{ width: share(batteryCost) + "%" }} /></i></div>
          )}
          <div><span>{t({ en: "Installation, BOS and margin (est.)", ro: "Montaj, BOS și marjă (est.)", ru: "Монтаж, BOS и маржа (оценка)", uk: "Монтаж, BOS і маржа (оцінка)" })}</span><b>{EUR(remainder)}</b><i aria-hidden="true"><s style={{ width: share(remainder) + "%" }} /></i></div>
          <div className="total"><span>{t({ en: "Total", ro: "Total", ru: "Итого", uk: "Разом" })}</span><b>{EUR(costEur)}</b></div>
        </div>
      </section>

      <section className="ws-card">
        <div className={"ws-status " + level}>
          <span className="ic" aria-hidden="true"><StatusIcon size={16} /></span>
          <div>
            <small>{t({ en: "String voltage check", ro: "Verificare tensiune șir", ru: "Проверка напряжения цепочки", uk: "Перевірка напруги стрінга" })}</small>
            <b>{level === "err"
              ? t({ en: "No inverter chosen yet", ro: "Niciun invertor ales încă", ru: "Инвертор ещё не выбран", uk: "Інвертор ще не вибрано" })
              : level === "warn"
              ? t({ en: "Above the inverter's limit", ro: "Peste limita invertorului", ru: "Выше предела инвертора", uk: "Вище межі інвертора" })
              : t({ en: "Within the inverter's limit", ro: "În limita invertorului", ru: "В пределах инвертора", uk: "У межах інвертора" })}</b>
            {!noInverter && (
              <p>{`${strings.perString} × ${sys.panel.voc} V ≈ ${Math.round(strings.vocCold)} V at −10 °C, ${vocExceeds ? t({ en: "limit", ro: "limită", ru: "предел", uk: "межа" }) + " " : "≤ "}${sys.inverter.maxDcV} V`}</p>
            )}
          </div>
        </div>
      </section>
    </aside>
  );
}
