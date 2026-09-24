"use client";
// InstallationStep.jsx — absorbs the old standalone Schedule tool: the week
// calendar, crew assignment, materials-readiness check, the field-mode
// checklist and handover certificate. The 4 static gradient "photo" boxes
// are replaced with PhotoGallery — an actual file capture, not a decoration.
import { useState } from "react";
import { X, CheckCircle2, FileText, Users, Boxes } from "lucide-react";
import {
  tx, protRows, downloadStudioDoc, DocReveal, useToast,
  WEEK_KEY, installKey, readJSON, writeJSON,
} from "../../../studio-kit.jsx";
import { PhotoGallery } from "./PhotoCapture.jsx";
import SignaturePad from "./SignaturePad.jsx";

const DAYS = { ro: ["Lun", "Mar", "Mie", "Joi", "Vin"], en: ["Mon", "Tue", "Wed", "Thu", "Fri"], ru: ["Пн", "Вт", "Ср", "Чт", "Пт"] };
const CREWS = [
  { name: "Echipa A", who: "Vadim · Sergiu", color: "#1E6B4E" },
  { name: "Echipa B", who: "Ion · Petru · Radu", color: "#3D6B8E" },
];
const SCHED = [
  { day: 0, client: "Elena Ciobanu", loc: "Botanica", kw: 8, crew: 1 },
  { day: 1, client: "Andrei Postică", loc: "Strășeni", kw: 5, crew: 0 },
  { day: 2, client: "Hala AgroNord", loc: "Chișinău", kw: 120, crew: 1 },
  { day: 3, client: "Igor Pîslaru", loc: "Bălți", kw: 6.5, crew: 0 },
];
const FIELD_STEPS = ["fld_arrive", "fld_mount", "fld_dc", "fld_ac", "fld_test"];
const FLD_LABEL = {
  fld_arrive: { en: "On site", ro: "Sosit la fața locului", ru: "На объекте" },
  fld_mount: { en: "Rails + panels mounted", ro: "Șine + panouri montate", ru: "Рейлы + панели установлены" },
  fld_dc: { en: "DC strings + isolator", ro: "Șiruri DC + separator", ru: "Цепочки DC + разъединитель" },
  fld_ac: { en: "Inverter + AC board", ro: "Invertor + tablou AC", ru: "Инвертор + щит AC" },
  fld_test: { en: "First power + readings", ro: "Prima pornire + măsurători", ru: "Первый пуск + замеры" },
};

export default function InstallationStep({ job, derived, lang }) {
  const t = (o) => tx(o, lang);
  const [toast, fire] = useToast();
  const { sys } = derived;
  const days = DAYS[lang] || DAYS.en;
  const kw = +job.kw || 0;

  const BLANK_STEPS = { fld_arrive: false, fld_mount: false, fld_dc: false, fld_ac: false, fld_test: false };
  const jobKey = installKey(job.id);
  const [steps, setSteps] = useState(() => readJSON(jobKey, { steps: BLANK_STEPS }).steps || BLANK_STEPS);
  const [signatureUrl, setSignatureUrl] = useState(() => readJSON(jobKey, {}).signatureDataUrl || null);
  const signed = !!signatureUrl;
  const saveInstall = (patch) => writeJSON(jobKey, { ...readJSON(jobKey, {}), ...patch });
  const toggleStep = (s) => { const n = { ...steps, [s]: !steps[s] }; setSteps(n); saveInstall({ steps: n }); };
  const handleSignature = (dataUrl) => {
    setSignatureUrl(dataUrl);
    // `signed` stays a real boolean alongside the image — jobStageContext /
    // isStepDone (the Job Hub pipeline + Workspace stepper) only ever read
    // that flag, not the image, so both must be written together.
    saveInstall({ signatureDataUrl: dataUrl, signed: !!dataUrl });
    if (dataUrl) fire(t({ en: "Client signature captured", ro: "Semnătura clientului înregistrată", ru: "Подпись клиента получена" }));
  };

  const panel = sys.panel;
  const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
  const battReady = sys.battery.stock > 0 && sys.battery.leadDays === 0;
  const mats = [
    { label: tx({ ro: `Panou ${panel.brand} ${panel.watt} W × ${modules}`, en: `${panel.brand} ${panel.watt} W panel × ${modules}`, ru: `Панель ${panel.brand} ${panel.watt} Вт × ${modules}` }, lang), st: panel.stock > modules ? "in" : "ord" },
    { label: tx({ ro: `Invertor ${sys.inverter.brand} hibrid`, en: `${sys.inverter.brand} hybrid inverter`, ru: `Гибридный инвертор ${sys.inverter.brand}` }, lang), st: sys.inverter.stock > 0 ? "in" : "ord" },
    ...((+job.batteryKwh || 0) > 0 ? [{ label: tx({ ro: `Baterie ${sys.battery.brand} ${job.batteryKwh} kWh`, en: `${sys.battery.brand} battery ${job.batteryKwh} kWh`, ru: `Батарея ${sys.battery.brand} ${job.batteryKwh} кВт·ч` }, lang), st: battReady ? "in" : "arr" }] : []),
    { label: tx({ ro: `Structură montaj ${sys.mount.brand}`, en: `${sys.mount.brand} mounting`, ru: `Крепёж ${sys.mount.brand}` }, lang), st: "in" },
    { label: tx({ ro: "Cablu DC/AC + protecții", en: "DC/AC cable + protections", ru: "Кабель DC/AC + защиты" }, lang), st: "in" },
  ];
  const allReady = mats.every((m) => m.st === "in");
  const doneN = FIELD_STEPS.filter((s) => steps[s]).length;

  const dcKw = (modules * panel.watt) / 1000;
  const strings = Math.max(1, Math.round(dcKw / 5.5));
  const mps = Math.ceil(modules / strings);
  const stringVoc = Math.round(mps * panel.voc * 1.03);
  const dateLoc = lang === "ru" ? "ru-RU" : lang === "en" ? "en-IE" : "ro-RO";
  const measRows = [
    [tx({ ro: "Rezistență de izolație DC (Riso)", en: "DC insulation resistance (Riso)", ru: "Сопротивление изоляции DC (Riso)" }, lang), "> 1 MΩ", "18 MΩ", true],
    [tx({ ro: `Tensiune șir Voc (${strings} × ${mps} module)`, en: `String Voc (${strings} × ${mps} modules)`, ru: `Voc цепочки (${strings} × ${mps})` }, lang), `≤ ${job.phases === 3 ? 800 : 500} V`, `${stringVoc} V`, stringVoc <= (job.phases === 3 ? 800 : 500)],
    [tx({ ro: "Rezistență priză de pământ", en: "Earth electrode resistance", ru: "Сопротивление заземления" }, lang), "≤ 4 Ω", "2,7 Ω", true],
    [tx({ ro: "Declanșare diferențial (RCD 30 mA)", en: "RCD trip (30 mA)", ru: "Срабатывание УЗО (30 мА)" }, lang), "< 40 ms", "28 ms", true],
    [tx({ ro: "Anti-insularizare (LoM)", en: "Anti-islanding (LoM)", ru: "Защита от островн. режима (LoM)" }, lang), tx({ ro: "declanșare", en: "trip", ru: "отключение" }, lang), tx({ ro: "≤ 0,15 s", en: "≤ 0.15 s", ru: "≤ 0,15 с" }, lang), true],
    [tx({ ro: "Polaritate DC + succesiune faze", en: "DC polarity + phase sequence", ru: "Полярность DC + чередование фаз" }, lang), tx({ ro: "corect", en: "correct", ru: "верно" }, lang), tx({ ro: "conform", en: "OK", ru: "норма" }, lang), true],
  ];
  const HANDED = [
    tx({ ro: "Manual de utilizare și acces la portalul de monitorizare", en: "User manual and monitoring-portal access", ru: "Руководство и доступ к порталу мониторинга" }, lang),
    tx({ ro: "Certificate de garanție (module, invertor, montaj)", en: "Warranty certificates (modules, inverter, workmanship)", ru: "Гарантийные сертификаты (модули, инвертор, монтаж)" }, lang),
    tx({ ro: "Schema electrică monofilară (as-built)", en: "Single-line diagram (as-built)", ru: "Однолинейная схема (as-built)" }, lang),
    tx({ ro: "Declarația de conformitate a electricianului", en: "Electrician's declaration of conformity", ru: "Декларация электрика о соответствии" }, lang),
  ];

  const [installs, setInstalls] = useState(() => readJSON(WEEK_KEY, SCHED));
  const [plan, setPlan] = useState({ day: 4, crew: 0 });
  const persistWeek = (n) => { setInstalls(n); writeJSON(WEEK_KEY, n); };
  const addActive = () => {
    persistWeek([...installs, { day: +plan.day, jobId: job.id, client: job.name, loc: String(job.address).split(",")[0], kw: +kw.toFixed(1), crew: +plan.crew }]);
    fire(t({ en: "Scheduled for {day}", ro: "Programat pentru {day}", ru: "Запланировано на {day}" }).replace("{day}", days[+plan.day]));
  };
  const delInstall = (idx) => { persistWeek(installs.filter((_, i) => i !== idx)); fire(t({ en: "Install removed", ro: "Montaj eliminat", ru: "Монтаж убран" })); };

  const assignedInstall = installs.find((s) => s.jobId === job.id || s.client === job.name);
  const assignedCrew = (assignedInstall != null ? CREWS[assignedInstall.crew] : null) || CREWS[0];

  return (
    <div className="space-y-6">
      {toast}

      {/* week calendar */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "This week", ro: "Săptămâna aceasta", ru: "Эта неделя" })}</h3>
          <select value={plan.day} onChange={(e) => setPlan((p) => ({ ...p, day: +e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-white">
            {days.map((d, di) => <option key={di} value={di}>{d}</option>)}
          </select>
          <select value={plan.crew} onChange={(e) => setPlan((p) => ({ ...p, crew: +e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-white">
            {CREWS.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
          </select>
          <button type="button" onClick={addActive} className="ws-fill-brand rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
            + {t({ en: "Schedule this job", ro: "Programează lucrarea", ru: "Запланировать объект" })}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {days.map((d, di) => {
            const dayJobs = installs.map((s, i) => [s, i]).filter(([s]) => s.day === di);
            return (
              <div key={di} className="flex min-h-[140px] flex-col rounded-lg border border-slate-200 bg-slate-50 dark:border-[#2C2C2C] dark:bg-[#242424]/50">
                <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5 dark:border-[#2C2C2C]">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#B0B0B0]">{d}</span>
                  {dayJobs.length > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-[9px] font-bold text-slate-600 dark:bg-[#383838] dark:text-[#D4D4D4]">
                      {dayJobs.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                  {dayJobs.length === 0 && (
                    <div className="flex flex-1 items-center justify-center text-[10px] italic text-slate-300 dark:text-[#3A3A3A]">
                      {t({ en: "no installs", ro: "fără montaje", ru: "нет монтажей" })}
                    </div>
                  )}
                  {dayJobs.map(([s, i]) => (
                    <div key={i} className="relative rounded-md border border-slate-200 bg-white p-1.5 pr-4 text-xs shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]"
                      style={{ borderLeftWidth: 3, borderLeftColor: CREWS[s.crew]?.color || "#1E6B4E" }}>
                      <button type="button" onClick={() => delInstall(i)} className="absolute right-1 top-1 text-slate-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                      <b className="block truncate font-semibold text-slate-800 dark:text-white">{s.client}</b>
                      <span className="block text-slate-500 dark:text-[#B0B0B0]">{s.loc} · {s.kw} kW</span>
                      <em className="not-italic font-medium" style={{ color: CREWS[s.crew]?.color }}>{CREWS[s.crew]?.name || "—"}</em>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* crews + materials */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white">
            <Users className="h-4 w-4 text-slate-400" /> {t({ en: "Crews", ro: "Echipe", ru: "Бригады" })}
          </h3>
          <div className="space-y-2">
            {CREWS.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-[#2C2C2C] dark:bg-[#242424]/50">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: c.color }} />
                <div className="flex-1">
                  <b className="block text-sm text-slate-800 dark:text-white">{c.name}</b>
                  <div className="text-xs text-slate-500 dark:text-[#B0B0B0]">{c.who}</div>
                </div>
                <span className="text-xs text-slate-400">{installs.filter((s) => s.crew === i).length} {t({ en: "jobs", ro: "lucrări", ru: "объектов" })}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white">
            <Boxes className="h-4 w-4 text-slate-400" /> {t({ en: "Materials", ro: "Materiale", ru: "Материалы" })}
          </h3>
          <ul className="mb-3 space-y-2">
            {mats.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#D4D4D4]">
                <span className={"flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-bold " +
                  (m.st === "in" ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400" : m.st === "arr" ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400" : "bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400")}>
                  {m.st === "in" ? "✓" : m.st === "arr" ? "→" : "!"}
                </span>
                <span className="flex-1">{m.label}</span>
              </li>
            ))}
          </ul>
          <div className={"rounded-lg px-3 py-2 text-xs font-semibold " + (allReady ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400" : "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400")}>
            {allReady ? t({ en: "Ready to install", ro: "Gata de montaj", ru: "Готово к монтажу" }) : t({ en: "Waiting on 1 line", ro: "Așteaptă 1 poziție", ru: "Ждём 1 позицию" })}
          </div>
        </div>
      </div>

      {/* field checklist + real photos + signature */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Field checklist", ro: "Listă la fața locului", ru: "Полевой чек-лист" })}</h3>
          <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-[#B0B0B0]">{doneN}/5</span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#242424]">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: (doneN / 5) * 100 + "%" }} />
        </div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-[#242424] dark:border-[#2C2C2C]">
          {FIELD_STEPS.map((s) => (
            <button key={s} type="button" onClick={() => toggleStep(s)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm">
              <span className={"flex h-5 w-5 flex-none items-center justify-center rounded-md " + (steps[s] ? "bg-brand-500 text-white" : "border-2 border-slate-300 dark:border-[#3A3A3A]")}>
                {steps[s] && <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
              <span className="text-slate-800 dark:text-white">{FLD_LABEL[s][lang] || FLD_LABEL[s].en}</span>
            </button>
          ))}
        </div>

        <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "On-site photos", ro: "Poze de la fața locului", ru: "Фото объекта" })}</h3>
        <PhotoGallery jobId={job.id} group="install" />

        <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Client signature", ro: "Semnătura clientului", ru: "Подпись клиента" })}</h3>
        <SignaturePad initialValue={signatureUrl} onChange={handleSignature}
          placeholder={t({ en: "Sign here with a finger, stylus, or mouse", ro: "Semnează aici cu degetul, stylus-ul sau mouse-ul", ru: "Подпишите здесь пальцем, стилусом или мышью" })}
          clearLabel={t({ en: "Clear", ro: "Șterge", ru: "Очистить" })} />
        {signed && (
          <p className="mt-1.5 text-xs font-medium text-brand-600 dark:text-brand-400">
            {t({ en: "Signed on site", ro: "Semnat la fața locului", ru: "Подписано на объекте" })}
          </p>
        )}
      </div>

      <button type="button" onClick={() => downloadStudioDoc("proces-verbal-" + (job.ref || "voltmira"))}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#3A3A3A] dark:text-[#D4D4D4] dark:hover:bg-[#242424]">
        <FileText className="h-4 w-4" /> {t({ en: "Handover certificate — Print / PDF", ro: "Proces-verbal — Printează / PDF", ru: "Акт приёмки — Печать / PDF" })}
      </button>

      <DocReveal lang={lang}>
        <div className="pv-doc">
          <div className="doc-co">VoltMira · {new Date().toLocaleDateString(dateLoc)} · {tx({ ro: "proces-verbal de recepție", en: "commissioning record", ru: "акт приёмки" }, lang)}</div>
          <h1>{tx({ ro: "Proces-verbal de punere în funcțiune", en: "Commissioning & handover certificate", ru: "Акт ввода в эксплуатацию и приёмки" }, lang)}</h1>
          <p className="doc-sub">{job.name}{job.address ? " · " + job.address : ""}</p>
          <div className="doc-grid" style={{ marginTop: 10 }}>
            <div className="doc-kv"><span>{tx({ ro: "Nr. proces-verbal", en: "Certificate no.", ru: "№ акта" }, lang)}</span><b>PV-{(job.ref || "VM-2026").replace(/^VM-?/, "")}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Nr. contract", en: "Contract no.", ru: "№ договора" }, lang)}</span><b>{job.contractNo || "—"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Data recepției", en: "Handover date", ru: "Дата приёмки" }, lang)}</span><b>{new Date().toLocaleDateString(dateLoc)}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Loc", en: "Place", ru: "Место" }, lang)}</span><b>{String(job.address || "").split(",").slice(-1)[0].trim() || "—"}</b></div>
          </div>

          <h2>{tx({ ro: "Părți", en: "Parties", ru: "Стороны" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Instalator", en: "Installer", ru: "Установщик" }, lang)}</span><b>VoltMira SRL</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Atestat", en: "Licence", ru: "Аттестат" }, lang)}</span><b>{job.atestat || "ANRE-MC"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Beneficiar", en: "Beneficiary", ru: "Получатель" }, lang)}</span><b>{job.name}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Echipa de montaj", en: "Install crew", ru: "Бригада" }, lang)}</span><b>{assignedCrew.who}</b></div>
          </div>

          <h2>{tx({ ro: "Instalația", en: "The installation", ru: "Установка" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Putere instalată", en: "Installed power", ru: "Мощность" }, lang)}</span><b>{kw.toFixed(1)} kW{(+job.batteryKwh || 0) > 0 ? ` · ${job.batteryKwh} kWh` : ""}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Module", en: "Modules", ru: "Модули" }, lang)}</span><b>{modules} × {panel.watt} W · {panel.brand}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Invertor", en: "Inverter", ru: "Инвертор" }, lang)}</span><b>{sys.inverter.brand} · {job.phases === 3 ? "3~ 400 V" : "1~ 230 V"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Structură de montaj", en: "Mounting", ru: "Крепёж" }, lang)}</span><b>{sys.mount.brand}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Configurație șiruri", en: "String layout", ru: "Схема цепочек" }, lang)}</span><b>{strings} × {mps} {tx({ ro: "module", en: "modules", ru: "модулей" }, lang)}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Contor", en: "Meter", ru: "Счётчик" }, lang)}</span><b>{tx({ ro: "bidirecțional, 4 cadrane", en: "bidirectional, 4-quadrant", ru: "двунаправленный" }, lang)}</b></div>
          </div>

          <h2>{tx({ ro: "Verificări la punere în funcțiune", en: "Commissioning checks", ru: "Проверки при вводе" }, lang)}</h2>
          <table>
            <tbody>
              {FIELD_STEPS.map((s) => (
                <tr key={s}>
                  <td>{FLD_LABEL[s][lang] || FLD_LABEL[s].en}</td>
                  <td className="r" style={{ width: 130 }}><b style={{ color: steps[s] ? "var(--green)" : "#B4700F" }}>{steps[s] ? tx({ ro: "efectuat", en: "done", ru: "выполнено" }, lang) : tx({ ro: "în curs", en: "pending", ru: "в процессе" }, lang)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>{tx({ ro: "Măsurători electrice", en: "Electrical measurements", ru: "Электрические измерения" }, lang)}</h2>
          <table>
            <thead><tr><th>{tx({ ro: "Verificare", en: "Test", ru: "Проверка" }, lang)}</th><th className="r">{tx({ ro: "Limită", en: "Limit", ru: "Предел" }, lang)}</th><th className="r">{tx({ ro: "Măsurat", en: "Measured", ru: "Измерено" }, lang)}</th></tr></thead>
            <tbody>
              {measRows.map(([name, lim, meas, ok], i) => (
                <tr key={i}><td>{name}</td><td className="r dim">{lim}</td><td className="r"><b style={{ color: ok ? "var(--green)" : "#B4472F" }}>{meas}</b></td></tr>
              ))}
            </tbody>
          </table>

          <h2>{tx({ ro: "Reglaje protecție de interfață (SR EN 50549-1)", en: "Interface protection settings (SR EN 50549-1)", ru: "Уставки защиты интерфейса (SR EN 50549-1)" }, lang)}</h2>
          <table>
            <thead><tr><th>{tx({ ro: "Funcție", en: "Function", ru: "Функция" }, lang)}</th><th className="r">{tx({ ro: "Prag", en: "Setting", ru: "Уставка" }, lang)}</th><th className="r">{tx({ ro: "Timp", en: "Time", ru: "Время" }, lang)}</th></tr></thead>
            <tbody>
              {protRows(lang === "ru" ? "ru" : lang === "en" ? "en" : "ro").slice(0, 5).map((p, i) => (
                <tr key={i}><td>{p.fn}</td><td className="r dim">{p.set}</td><td className="r">{p.time}</td></tr>
              ))}
            </tbody>
          </table>

          <h2>{tx({ ro: "Documente predate beneficiarului", en: "Documents handed to the beneficiary", ru: "Переданные документы" }, lang)}</h2>
          <ul className="doc-list">
            {HANDED.map((h, i) => <li key={i}>{h}</li>)}
          </ul>

          <p className="doc-note">{tx({
            ro: "Invertorul deține funcție anti-insularizare (LoM); prima pornire și măsurătorile au fost efectuate conform SR EN 50549-1 și IEC 60364-6. Instalația a fost verificată și predată în stare de funcționare, iar beneficiarul a fost instruit privind operarea și oprirea de urgență.",
            en: "The inverter has loss-of-mains (anti-islanding) protection; first power and measurements were performed per SR EN 50549-1 and IEC 60364-6. The installation was verified and handed over in working order, and the beneficiary was instructed on operation and emergency shutdown.",
            ru: "Инвертор имеет защиту от островного режима (LoM); первый пуск и измерения выполнены по SR EN 50549-1 и IEC 60364-6. Установка проверена и передана в рабочем состоянии, получатель проинструктирован по эксплуатации и аварийному отключению.",
          }, lang)}</p>
          <div className="doc-sign">
            <div>{tx({ ro: "Instalator autorizat (nume, semnătură, ștampilă)", en: "Authorised installer (name, signature, stamp)", ru: "Уполномоченный установщик (имя, подпись, печать)" }, lang)}</div>
            <div>
              {signed ? (
                <>
                  <img src={signatureUrl} alt="" style={{ height: 40, display: "block", marginBottom: 2 }} />
                  {job.name}{tx({ ro: " — semnat pe teren", en: " — signed on site", ru: " — подписано на объекте" }, lang)}
                </>
              ) : tx({ ro: "Beneficiar (nume, semnătură)", en: "Beneficiary (name, signature)", ru: "Получатель (имя, подпись)" }, lang)}
            </div>
          </div>
        </div>
      </DocReveal>

      <style dangerouslySetInnerHTML={{ __html: `
        .pv-doc td.r,.pv-doc th.r{text-align:right;font-variant-numeric:tabular-nums}
        .pv-doc td.dim{color:#777;font-size:10.5px}
        .pv-doc .doc-list{margin:2px 0 6px;padding-left:18px;font-size:11.5px;color:#333;line-height:1.6}
        .pv-doc .doc-list li{margin:0 0 2px}
      ` }} />
    </div>
  );
}
