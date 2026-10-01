"use client";
// InstallationStep.jsx — the install itself: the week calendar and crews,
// whether the materials are in stock, the on-site checklist, photos from
// site, the client's signature and the handover certificate. `touch` tells
// the workspace a checklist tick or a signature was saved, so the journey
// line above updates at once.
import { useState } from "react";
import { X, Check, FileText, Users, Boxes, CalendarDays, ListChecks, Camera, PenLine, Truck } from "lucide-react";
import {
  tx, protRows, downloadStudioDoc, DocReveal, useToast,
  WEEK_KEY, installKey, readJSON, writeJSON,
} from "../../../studio-kit.jsx";
import { PhotoGallery } from "./PhotoCapture.jsx";
import SignaturePad from "./SignaturePad.jsx";

const DAYS = { ro: ["Lun", "Mar", "Mie", "Joi", "Vin"], en: ["Mon", "Tue", "Wed", "Thu", "Fri"], ru: ["Пн", "Вт", "Ср", "Чт", "Пт"], uk: ["Пн", "Вт", "Ср", "Чт", "Пт"] };
const CREWS = [
  { name: "Echipa A", who: "Vadim, Sergiu", color: "#1E6B4E" },
  { name: "Echipa B", who: "Ion, Petru, Radu", color: "#3D6B8E" },
];
const SCHED = [
  { day: 0, client: "Elena Ciobanu", loc: "Botanica", kw: 8, crew: 1 },
  { day: 1, client: "Andrei Postică", loc: "Strășeni", kw: 5, crew: 0 },
  { day: 2, client: "Hala AgroNord", loc: "Chișinău", kw: 120, crew: 1 },
  { day: 3, client: "Igor Pîslaru", loc: "Bălți", kw: 6.5, crew: 0 },
];
const FIELD_STEPS = ["fld_arrive", "fld_mount", "fld_dc", "fld_ac", "fld_test"];
const FLD_LABEL = {
  fld_arrive: { en: "On site", ro: "Sosit la fața locului", ru: "На объекте", uk: "На об’єкті" },
  fld_mount: { en: "Rails + panels mounted", ro: "Șine + panouri montate", ru: "Рейлы + панели установлены", uk: "Рейки + панелі змонтовано" },
  fld_dc: { en: "DC strings + isolator", ro: "Șiruri DC + separator", ru: "Цепочки DC + разъединитель", uk: "DC-стрінги + роз’єднувач" },
  fld_ac: { en: "Inverter + AC board", ro: "Invertor + tablou AC", ru: "Инвертор + щит AC", uk: "Інвертор + щит AC" },
  fld_test: { en: "First power + readings", ro: "Prima pornire + măsurători", ru: "Первый пуск + замеры", uk: "Перший пуск + вимірювання" },
};

export default function InstallationStep({ job, derived, lang, touch = () => {} }) {
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
  const saveInstall = (patch) => { writeJSON(jobKey, { ...readJSON(jobKey, {}), ...patch }); touch(); };
  const toggleStep = (s) => { const n = { ...steps, [s]: !steps[s] }; setSteps(n); saveInstall({ steps: n }); };
  const handleSignature = (dataUrl) => {
    setSignatureUrl(dataUrl);
    // `signed` stays a real boolean alongside the image — jobStageContext /
    // isStepDone (the Job Hub pipeline + Workspace stepper) only ever read
    // that flag, not the image, so both must be written together.
    saveInstall({ signatureDataUrl: dataUrl, signed: !!dataUrl });
    if (dataUrl) fire(t({ en: "Client signature captured", ro: "Semnătura clientului înregistrată", ru: "Подпись клиента получена", uk: "Підпис клієнта отримано" }));
  };

  const panel = sys.panel;
  const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
  const battReady = sys.battery.stock > 0 && sys.battery.leadDays === 0;
  const mats = [
    { label: tx({ ro: `Panou ${panel.brand} ${panel.watt} W × ${modules}`, en: `${panel.brand} ${panel.watt} W panel × ${modules}`, ru: `Панель ${panel.brand} ${panel.watt} Вт × ${modules}`, uk: `Панель ${panel.brand} ${panel.watt} Вт × ${modules}` }, lang), st: panel.stock > modules ? "in" : "ord" },
    { label: tx({ ro: `Invertor ${sys.inverter.brand} hibrid`, en: `${sys.inverter.brand} hybrid inverter`, ru: `Гибридный инвертор ${sys.inverter.brand}`, uk: `Гібридний інвертор ${sys.inverter.brand}` }, lang), st: sys.inverter.stock > 0 ? "in" : "ord" },
    ...((+job.batteryKwh || 0) > 0 ? [{ label: tx({ ro: `Baterie ${sys.battery.brand} ${job.batteryKwh} kWh`, en: `${sys.battery.brand} battery ${job.batteryKwh} kWh`, ru: `Батарея ${sys.battery.brand} ${job.batteryKwh} кВт·ч`, uk: `Батарея ${sys.battery.brand} ${job.batteryKwh} кВт·год` }, lang), st: battReady ? "in" : "arr" }] : []),
    { label: tx({ ro: `Structură montaj ${sys.mount.brand}`, en: `${sys.mount.brand} mounting`, ru: `Крепёж ${sys.mount.brand}`, uk: `Кріплення ${sys.mount.brand}` }, lang), st: "in" },
    { label: tx({ ro: "Cablu DC/AC + protecții", en: "DC/AC cable + protections", ru: "Кабель DC/AC + защиты", uk: "Кабель DC/AC + захист" }, lang), st: "in" },
  ];
  const allReady = mats.every((m) => m.st === "in");
  const doneN = FIELD_STEPS.filter((s) => steps[s]).length;

  const dcKw = (modules * panel.watt) / 1000;
  const strings = Math.max(1, Math.round(dcKw / 5.5));
  const mps = Math.ceil(modules / strings);
  const stringVoc = Math.round(mps * panel.voc * 1.03);
  const dateLoc = { ru: "ru-RU", uk: "uk-UA", en: "en-IE" }[lang] || "ro-RO";
  const measRows = [
    [tx({ ro: "Rezistență de izolație DC (Riso)", en: "DC insulation resistance (Riso)", ru: "Сопротивление изоляции DC (Riso)", uk: "Опір ізоляції DC (Riso)" }, lang), "> 1 MΩ", "18 MΩ", true],
    [tx({ ro: `Tensiune șir Voc (${strings} × ${mps} module)`, en: `String Voc (${strings} × ${mps} modules)`, ru: `Voc цепочки (${strings} × ${mps})`, uk: `Voc стрінга (${strings} × ${mps})` }, lang), `≤ ${job.phases === 3 ? 800 : 500} V`, `${stringVoc} V`, stringVoc <= (job.phases === 3 ? 800 : 500)],
    [tx({ ro: "Rezistență priză de pământ", en: "Earth electrode resistance", ru: "Сопротивление заземления", uk: "Опір заземлення" }, lang), "≤ 4 Ω", "2,7 Ω", true],
    [tx({ ro: "Declanșare diferențial (RCD 30 mA)", en: "RCD trip (30 mA)", ru: "Срабатывание УЗО (30 мА)", uk: "Спрацювання ПЗВ (30 мА)" }, lang), "< 40 ms", "28 ms", true],
    [tx({ ro: "Anti-insularizare (LoM)", en: "Anti-islanding (LoM)", ru: "Защита от островн. режима (LoM)", uk: "Захист від острівного режиму (LoM)" }, lang), tx({ ro: "declanșare", en: "trip", ru: "отключение", uk: "вимкнення" }, lang), tx({ ro: "≤ 0,15 s", en: "≤ 0.15 s", ru: "≤ 0,15 с", uk: "≤ 0,15 с" }, lang), true],
    [tx({ ro: "Polaritate DC + succesiune faze", en: "DC polarity + phase sequence", ru: "Полярность DC + чередование фаз", uk: "Полярність DC + чергування фаз" }, lang), tx({ ro: "corect", en: "correct", ru: "верно", uk: "правильно" }, lang), tx({ ro: "conform", en: "OK", ru: "норма", uk: "норма" }, lang), true],
  ];
  const HANDED = [
    tx({ ro: "Manual de utilizare și acces la portalul de monitorizare", en: "User manual and monitoring-portal access", ru: "Руководство и доступ к порталу мониторинга", uk: "Інструкція та доступ до порталу моніторингу" }, lang),
    tx({ ro: "Certificate de garanție (module, invertor, montaj)", en: "Warranty certificates (modules, inverter, workmanship)", ru: "Гарантийные сертификаты (модули, инвертор, монтаж)", uk: "Гарантійні сертифікати (модулі, інвертор, монтаж)" }, lang),
    tx({ ro: "Schema electrică monofilară (as-built)", en: "Single-line diagram (as-built)", ru: "Однолинейная схема (as-built)", uk: "Однолінійна схема (as-built)" }, lang),
    tx({ ro: "Declarația de conformitate a electricianului", en: "Electrician's declaration of conformity", ru: "Декларация электрика о соответствии", uk: "Декларація електрика про відповідність" }, lang),
  ];

  const [installs, setInstalls] = useState(() => readJSON(WEEK_KEY, SCHED));
  const [plan, setPlan] = useState({ day: 4, crew: 0 });
  const persistWeek = (n) => { setInstalls(n); writeJSON(WEEK_KEY, n); touch(); };
  const addActive = () => {
    persistWeek([...installs, { day: +plan.day, jobId: job.id, client: job.name, loc: String(job.address).split(",")[0], kw: +kw.toFixed(1), crew: +plan.crew }]);
    fire(t({ en: "Scheduled for {day}", ro: "Programat pentru {day}", ru: "Запланировано на {day}", uk: "Заплановано на {day}" }).replace("{day}", days[+plan.day]));
  };
  const delInstall = (idx) => { persistWeek(installs.filter((_, i) => i !== idx)); fire(t({ en: "Install removed", ro: "Montaj eliminat", ru: "Монтаж убран", uk: "Монтаж прибрано" })); };

  const assignedInstall = installs.find((s) => s.jobId === job.id || s.client === job.name);
  const assignedCrew = (assignedInstall != null ? CREWS[assignedInstall.crew] : null) || CREWS[0];

  return (
    <>
      {toast}

      <div className="ws-sec">
        <div className="ws-sec-h"><CalendarDays size={16} aria-hidden="true" />{t({ en: "This week", ro: "Săptămâna aceasta", ru: "Эта неделя", uk: "Цей тиждень" })}</div>
        <div className="ws-row">
          <select value={plan.day} onChange={(e) => setPlan((p) => ({ ...p, day: +e.target.value }))} className="ws-select" style={{ width: "auto" }}
            aria-label={t({ en: "Day", ro: "Ziua", ru: "День", uk: "День" })}>
            {days.map((d, di) => <option key={di} value={di}>{d}</option>)}
          </select>
          <select value={plan.crew} onChange={(e) => setPlan((p) => ({ ...p, crew: +e.target.value }))} className="ws-select" style={{ width: "auto" }}
            aria-label={t({ en: "Crew", ro: "Echipa", ru: "Бригада", uk: "Бригада" })}>
            {CREWS.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
          </select>
          <button type="button" onClick={addActive} className="btn primary sm">
            {t({ en: "Put this job in the week", ro: "Pune lucrarea în săptămână", ru: "Поставить объект в неделю", uk: "Поставити об’єкт у тиждень" })}
          </button>
        </div>
        <div className="ws-week">
          {days.map((d, di) => {
            const dayJobs = installs.map((s, i) => [s, i]).filter(([s]) => s.day === di);
            return (
              <div key={di} className="ws-day">
                <div className="ws-day-top"><span>{d}</span>{dayJobs.length > 0 && <em>{dayJobs.length}</em>}</div>
                <div className="ws-day-list">
                  {dayJobs.length === 0 && <div className="ws-day-empty">{t({ en: "Free", ro: "Liber", ru: "Свободно", uk: "Вільно" })}</div>}
                  {dayJobs.map(([s, i]) => (
                    <div key={i} className="ws-slot" style={{ "--crew": CREWS[s.crew]?.color || "var(--green)" }}>
                      <button type="button" onClick={() => delInstall(i)} className="ws-x" aria-label={t({ en: "Remove", ro: "Elimină", ru: "Убрать", uk: "Прибрати" })}><X size={12} /></button>
                      <b>{s.client}</b>
                      <span>{s.loc}, {s.kw} kW</span>
                      <em>{CREWS[s.crew]?.name || "—"}</em>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ws-cols">
        <div className="ws-sec">
          <div className="ws-sec-h"><Users size={16} aria-hidden="true" />{t({ en: "Crews", ro: "Echipe", ru: "Бригады", uk: "Бригади" })}</div>
          <div className="ws-list">
            {CREWS.map((c, i) => (
              <div key={i} className="ws-item">
                <span className="ws-dot" style={{ background: c.color }} aria-hidden="true" />
                <div><b>{c.name}</b><small>{c.who}</small></div>
                <span className="ws-aside">{installs.filter((s) => s.crew === i).length} {t({ en: "jobs", ro: "lucrări", ru: "объектов", uk: "об’єктів" })}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ws-sec">
          <div className="ws-sec-h"><Boxes size={16} aria-hidden="true" />{t({ en: "Materials", ro: "Materiale", ru: "Материалы", uk: "Матеріали" })}</div>
          <div className="ws-list" style={{ gap: 9 }}>
            {mats.map((m, i) => (
              <div key={i} className="ws-mat">
                <i className={m.st === "ord" ? "ord" : "in"} aria-hidden="true">{m.st === "in" ? <Check size={12} strokeWidth={3} /> : m.st === "arr" ? <Truck size={12} strokeWidth={2.4} /> : "!"}</i>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
          <div className={"ws-note " + (allReady ? "ok" : "warn")} style={{ padding: "9px 12px" }}>
            <div><b>{allReady ? t({ en: "Everything is in stock.", ro: "Totul e pe stoc.", ru: "Всё есть на складе.", uk: "Усе є на складі." }) : t({ en: "Waiting on one line.", ro: "Se așteaptă o poziție.", ru: "Ждём одну позицию.", uk: "Чекаємо одну позицію." })}</b></div>
          </div>
        </div>
      </div>

      <div className="ws-sec">
        <div className="ws-sec-h"><ListChecks size={16} aria-hidden="true" />{t({ en: "Site checklist", ro: "Lista de pe teren", ru: "Чек-лист на объекте", uk: "Чек-лист на об’єкті" })}<span className="ws-aside">{doneN}/5</span></div>
        <div className="ws-progress" aria-hidden="true"><i style={{ width: (doneN / 5) * 100 + "%" }} /></div>
        <div className="ws-checks">
          {FIELD_STEPS.map((s) => (
            <button key={s} type="button" onClick={() => toggleStep(s)} className={"ws-check" + (steps[s] ? " done" : "")} aria-pressed={steps[s]}>
              <span className="box" aria-hidden="true">{steps[s] && <Check size={13} strokeWidth={3} />}</span>
              <span className="lbl">{FLD_LABEL[s][lang] || FLD_LABEL[s].en}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ws-sec">
        <div className="ws-sec-h"><Camera size={16} aria-hidden="true" />{t({ en: "Photos from site", ro: "Poze de pe teren", ru: "Фото с объекта", uk: "Фото з об’єкта" })}</div>
        <PhotoGallery jobId={job.id} group="install" addLabel={t({ en: "Add photo", ro: "Adaugă poză", ru: "Добавить фото", uk: "Додати фото" })} />
      </div>

      <div className="ws-sec">
        <div className="ws-sec-h"><PenLine size={16} aria-hidden="true" />{t({ en: "Client signature", ro: "Semnătura clientului", ru: "Подпись клиента", uk: "Підпис клієнта" })}
          {signed && <span className="ws-aside ws-good">{t({ en: "Signed on site", ro: "Semnat pe teren", ru: "Подписано на объекте", uk: "Підписано на об’єкті" })}</span>}
        </div>
        <SignaturePad initialValue={signatureUrl} onChange={handleSignature}
          placeholder={t({ en: "Sign here with a finger, stylus or mouse", ro: "Semnați aici cu degetul, stylus-ul sau mouse-ul", ru: "Подпишите здесь пальцем, стилусом или мышью", uk: "Підпишіть тут пальцем, стилусом або мишею" })}
          clearLabel={t({ en: "Clear", ro: "Șterge", ru: "Очистить", uk: "Очистити" })} />
      </div>

      <div className="ws-actions">
        <button type="button" onClick={() => downloadStudioDoc("proces-verbal-" + (job.ref || "voltmira"))} className="btn ghost sm">
          <FileText size={15} aria-hidden="true" /> {t({ en: "Handover certificate: print or PDF", ro: "Proces-verbal: printează sau PDF", ru: "Акт приёмки: печать или PDF", uk: "Акт приймання: друк або PDF" })}
        </button>
      </div>

      <DocReveal lang={lang}>
        <div className="pv-doc">
          <div className="doc-co">VoltMira, {new Date().toLocaleDateString(dateLoc)}, {tx({ ro: "proces-verbal de recepție", en: "commissioning record", ru: "акт приёмки", uk: "акт приймання" }, lang)}</div>
          <h1>{tx({ ro: "Proces-verbal de punere în funcțiune", en: "Commissioning & handover certificate", ru: "Акт ввода в эксплуатацию и приёмки", uk: "Акт введення в експлуатацію та приймання" }, lang)}</h1>
          <p className="doc-sub">{job.name}{job.address ? ", " + job.address : ""}</p>
          <div className="doc-grid" style={{ marginTop: 10 }}>
            <div className="doc-kv"><span>{tx({ ro: "Nr. proces-verbal", en: "Certificate no.", ru: "№ акта", uk: "№ акта" }, lang)}</span><b>PV-{(job.ref || "VM-2026").replace(/^VM-?/, "")}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Nr. contract", en: "Contract no.", ru: "№ договора", uk: "№ договору" }, lang)}</span><b>{job.contractNo || "—"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Data recepției", en: "Handover date", ru: "Дата приёмки", uk: "Дата приймання" }, lang)}</span><b>{new Date().toLocaleDateString(dateLoc)}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Loc", en: "Place", ru: "Место", uk: "Місце" }, lang)}</span><b>{String(job.address || "").split(",").slice(-1)[0].trim() || "—"}</b></div>
          </div>

          <h2>{tx({ ro: "Părți", en: "Parties", ru: "Стороны", uk: "Сторони" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Instalator", en: "Installer", ru: "Установщик", uk: "Монтажник" }, lang)}</span><b>VoltMira SRL</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Atestat", en: "Licence", ru: "Аттестат", uk: "Атестат" }, lang)}</span><b>{job.atestat || "ANRE-MC"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Beneficiar", en: "Beneficiary", ru: "Получатель", uk: "Отримувач" }, lang)}</span><b>{job.name}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Echipa de montaj", en: "Install crew", ru: "Бригада", uk: "Бригада" }, lang)}</span><b>{assignedCrew.who}</b></div>
          </div>

          <h2>{tx({ ro: "Instalația", en: "The installation", ru: "Установка", uk: "Установка" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Putere instalată", en: "Installed power", ru: "Мощность", uk: "Потужність" }, lang)}</span><b>{kw.toFixed(1)} kW{(+job.batteryKwh || 0) > 0 ? `, ${job.batteryKwh} kWh` : ""}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Module", en: "Modules", ru: "Модули", uk: "Модулі" }, lang)}</span><b>{modules} × {panel.watt} W, {panel.brand}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Invertor", en: "Inverter", ru: "Инвертор", uk: "Інвертор" }, lang)}</span><b>{sys.inverter.brand}, {job.phases === 3 ? "3~ 400 V" : "1~ 230 V"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Structură de montaj", en: "Mounting", ru: "Крепёж", uk: "Кріплення" }, lang)}</span><b>{sys.mount.brand}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Configurație șiruri", en: "String layout", ru: "Схема цепочек", uk: "Схема стрінгів" }, lang)}</span><b>{strings} × {mps} {tx({ ro: "module", en: "modules", ru: "модулей", uk: "модулів" }, lang)}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Contor", en: "Meter", ru: "Счётчик", uk: "Лічильник" }, lang)}</span><b>{tx({ ro: "bidirecțional, 4 cadrane", en: "bidirectional, 4-quadrant", ru: "двунаправленный", uk: "двонаправлений" }, lang)}</b></div>
          </div>

          <h2>{tx({ ro: "Verificări la punere în funcțiune", en: "Commissioning checks", ru: "Проверки при вводе", uk: "Перевірки під час введення" }, lang)}</h2>
          <table>
            <tbody>
              {FIELD_STEPS.map((s) => (
                <tr key={s}>
                  <td>{FLD_LABEL[s][lang] || FLD_LABEL[s].en}</td>
                  <td className="r" style={{ width: 130 }}><b style={{ color: steps[s] ? "var(--green)" : "#B4700F" }}>{steps[s] ? tx({ ro: "efectuat", en: "done", ru: "выполнено", uk: "виконано" }, lang) : tx({ ro: "în curs", en: "pending", ru: "в процессе", uk: "у процесі" }, lang)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>{tx({ ro: "Măsurători electrice", en: "Electrical measurements", ru: "Электрические измерения", uk: "Електричні вимірювання" }, lang)}</h2>
          <table>
            <thead><tr><th>{tx({ ro: "Verificare", en: "Test", ru: "Проверка", uk: "Перевірка" }, lang)}</th><th className="r">{tx({ ro: "Limită", en: "Limit", ru: "Предел", uk: "Межа" }, lang)}</th><th className="r">{tx({ ro: "Măsurat", en: "Measured", ru: "Измерено", uk: "Виміряно" }, lang)}</th></tr></thead>
            <tbody>
              {measRows.map(([name, lim, meas, ok], i) => (
                <tr key={i}><td>{name}</td><td className="r dim">{lim}</td><td className="r"><b style={{ color: ok ? "var(--green)" : "#B4472F" }}>{meas}</b></td></tr>
              ))}
            </tbody>
          </table>

          <h2>{tx({ ro: "Reglaje protecție de interfață (SR EN 50549-1)", en: "Interface protection settings (SR EN 50549-1)", ru: "Уставки защиты интерфейса (SR EN 50549-1)", uk: "Уставки захисту інтерфейсу (SR EN 50549-1)" }, lang)}</h2>
          <table>
            <thead><tr><th>{tx({ ro: "Funcție", en: "Function", ru: "Функция", uk: "Функція" }, lang)}</th><th className="r">{tx({ ro: "Prag", en: "Setting", ru: "Уставка", uk: "Уставка" }, lang)}</th><th className="r">{tx({ ro: "Timp", en: "Time", ru: "Время", uk: "Час" }, lang)}</th></tr></thead>
            <tbody>
              {protRows(["ru", "uk", "en"].includes(lang) ? lang : "ro").slice(0, 5).map((p, i) => (
                <tr key={i}><td>{p.fn}</td><td className="r dim">{p.set}</td><td className="r">{p.time}</td></tr>
              ))}
            </tbody>
          </table>

          <h2>{tx({ ro: "Documente predate beneficiarului", en: "Documents handed to the beneficiary", ru: "Переданные документы", uk: "Передані документи" }, lang)}</h2>
          <ul className="doc-list">
            {HANDED.map((h, i) => <li key={i}>{h}</li>)}
          </ul>

          <p className="doc-note">{tx({
            ro: "Invertorul deține funcție anti-insularizare (LoM); prima pornire și măsurătorile au fost efectuate conform SR EN 50549-1 și IEC 60364-6. Instalația a fost verificată și predată în stare de funcționare, iar beneficiarul a fost instruit privind operarea și oprirea de urgență.",
            en: "The inverter has loss-of-mains (anti-islanding) protection; first power and measurements were performed per SR EN 50549-1 and IEC 60364-6. The installation was verified and handed over in working order, and the beneficiary was instructed on operation and emergency shutdown.",
            ru: "Инвертор имеет защиту от островного режима (LoM); первый пуск и измерения выполнены по SR EN 50549-1 и IEC 60364-6. Установка проверена и передана в рабочем состоянии, получатель проинструктирован по эксплуатации и аварийному отключению.",
            uk: "Інвертор має захист від острівного режиму (LoM); перший пуск і вимірювання виконано за SR EN 50549-1 та IEC 60364-6. Установку перевірено й передано в робочому стані, отримувача проінструктовано щодо експлуатації та аварійного вимкнення.",
          }, lang)}</p>
          <div className="doc-sign">
            <div>{tx({ ro: "Instalator autorizat (nume, semnătură, ștampilă)", en: "Authorised installer (name, signature, stamp)", ru: "Уполномоченный установщик (имя, подпись, печать)", uk: "Уповноважений монтажник (ім’я, підпис, печатка)" }, lang)}</div>
            <div>
              {signed ? (
                <>
                  <img src={signatureUrl} alt="" style={{ height: 40, display: "block", marginBottom: 2 }} />
                  {job.name}{tx({ ro: ", semnat pe teren", en: ", signed on site", ru: ", подписано на объекте", uk: ", підписано на об’єкті" }, lang)}
                </>
              ) : tx({ ro: "Beneficiar (nume, semnătură)", en: "Beneficiary (name, signature)", ru: "Получатель (имя, подпись)", uk: "Отримувач (ім’я, підпис)" }, lang)}
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
    </>
  );
}
