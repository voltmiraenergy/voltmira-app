"use client";
// Studio · Install schedule.
// The week's installs on a calendar with crews, a materials-ready check against
// the catalog, and a phone view of the on-site checklist + photos + signature
// that works offline. All mock.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, downloadStudioDoc,
  useStudioClient, ClientBar, systemFor, protRows,
} from "../studio-kit.jsx";

const TX = {
  title: { en: "Install schedule", ro: "Planificare montaj", ru: "График монтажа" },
  sub: {
    en: "The week's installs, the crew on each, whether the gear is in — and a phone view for the roof that doesn't need signal.",
    ro: "Montajele săptămânii, echipa de pe fiecare, dacă materialul e în stoc — și o vedere de telefon pentru acoperiș care nu are nevoie de semnal.",
    ru: "Монтажи недели, бригада на каждом, есть ли оборудование — и телефонный вид для крыши без связи.",
  },
  note: {
    en: "The materials check reads the same catalog the quote's bill of materials uses; the phone view is what the fitter opens on site — it queues writes and syncs when the signal comes back.",
    ro: "Verificarea materialelor citește același catalog ca devizul ofertei; vederea de telefon e ce deschide montatorul la fața locului — pune la coadă scrierile și le sincronizează când revine semnalul.",
    ru: "Проверка материалов читает тот же каталог, что и спецификация; телефонный вид открывает монтажник на объекте — операции в очереди и синхронизация при возврате связи.",
  },
  week: { en: "This week", ro: "Săptămâna aceasta", ru: "Эта неделя" },
  crews: { en: "Crews", ro: "Echipe", ru: "Бригады" },
  jobsN: { en: "{n} jobs", ro: "{n} lucrări", ru: "{n} объектов" },
  materials: { en: "Materials for", ro: "Materiale pentru", ru: "Материалы для" },
  inStock: { en: "in stock", ro: "în stoc", ru: "в наличии" },
  arriving: { en: "arriving {d}", ro: "sosește {d}", ru: "прибудет {d}" },
  toOrder: { en: "to order", ro: "de comandat", ru: "заказать" },
  ready: { en: "Ready to install", ro: "Gata de montaj", ru: "Готово к монтажу" },
  waiting: { en: "Waiting on 1 line", ro: "Așteaptă 1 poziție", ru: "Ждём 1 позицию" },
  field: { en: "Field mode", ro: "Mod teren", ru: "Полевой режим" },
  offline: { en: "Offline · 3 changes queued · syncs when back online", ro: "Offline · 3 modificări în coadă · se sincronizează la revenirea online", ru: "Оффлайн · 3 изменения в очереди · синхронизация при подключении" },
  fld_arrive: { en: "On site", ro: "Sosit la fața locului", ru: "На объекте" },
  fld_mount: { en: "Rails + panels mounted", ro: "Șine + panouri montate", ru: "Рейлы + панели установлены" },
  fld_dc: { en: "DC strings + isolator", ro: "Șiruri DC + separator", ru: "Цепочки DC + разъединитель" },
  fld_ac: { en: "Inverter + AC board", ro: "Invertor + tablou AC", ru: "Инвертор + щит AC" },
  fld_test: { en: "First power + readings", ro: "Prima pornire + măsurători", ru: "Первый пуск + замеры" },
  fld_photos: { en: "Photos", ro: "Poze", ru: "Фото" },
  fld_sign: { en: "Client signature", ro: "Semnătura clientului", ru: "Подпись клиента" },
  fld_signed: { en: "Signed on site", ro: "Semnat la fața locului", ru: "Подписано на объекте" },
  tap: { en: "tap to sign", ro: "atinge pentru semnătură", ru: "нажмите для подписи" },
};

const DAYS = { ro: ["Lun", "Mar", "Mie", "Joi", "Vin"], en: ["Mon", "Tue", "Wed", "Thu", "Fri"], ru: ["Пн", "Вт", "Ср", "Чт", "Пт"] };
const CREWS = [
  { name: "Echipa A", who: "Vadim · Sergiu", color: "var(--green)" },
  { name: "Echipa B", who: "Ion · Petru · Radu", color: "var(--blue)" },
];
// Same jobs as the payments ledger and the service log.
const SCHED = [
  { day: 0, client: "Elena Ciobanu", loc: "Botanica", kw: 8, crew: 1 },
  { day: 1, client: "Andrei Postică", loc: "Strășeni", kw: 5, crew: 0 },
  { day: 2, client: "Hala AgroNord", loc: "Chișinău", kw: 120, crew: 1 },
  { day: 3, client: "Igor Pîslaru", loc: "Bălți", kw: 6.5, crew: 0 },
];

export default function SchedulePreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Install schedule — VoltMira Studio"; }, []);

  const days = DAYS[lang] || DAYS.en;

  // The on-site checklist + signature are real per-client state, saved in this
  // browser — so the handover certificate reflects the actual job, not a demo.
  const BLANK_STEPS = { fld_arrive: false, fld_mount: false, fld_dc: false, fld_ac: false, fld_test: false };
  const jobKey = "voltmira_studio_install_" + (String(client.ref || client.contractNo || "default").replace(/[^\w-]/g, "") || "default");
  const [steps, setSteps] = useState(BLANK_STEPS);
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(jobKey) || "null");
      setSteps(s && s.steps ? { ...BLANK_STEPS, ...s.steps } : BLANK_STEPS);
      setSigned(!!(s && s.signed));
    } catch { setSteps(BLANK_STEPS); setSigned(false); }
  }, [jobKey]);
  const saveInstall = (patch) => {
    try {
      const cur = JSON.parse(localStorage.getItem(jobKey) || "{}");
      localStorage.setItem(jobKey, JSON.stringify({ steps, signed, ...cur, ...patch }));
    } catch { /* private mode */ }
  };
  const toggleStep = (s) => { const n = { ...steps, [s]: !steps[s] }; setSteps(n); saveInstall({ steps: n, signed }); };
  const toggleSigned = () => { const v = !signed; setSigned(v); saveInstall({ steps, signed: v }); };

  const sys = useMemo(() => systemFor(client), [client]);
  const panel = sys.panel;
  const kw = +client.kw || 0;
  const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
  const battReady = sys.battery.stock > 0 && sys.battery.leadDays === 0;
  const mats = [
    { label: tx({ ro: `Panou ${panel.brand} ${panel.watt} W × ${modules}`, en: `${panel.brand} ${panel.watt} W panel × ${modules}`, ru: `Панель ${panel.brand} ${panel.watt} Вт × ${modules}` }, lang), st: panel.stock > modules ? "in" : "ord" },
    { label: tx({ ro: `Invertor ${sys.inverter.brand} hibrid`, en: `${sys.inverter.brand} hybrid inverter`, ru: `Гибридный инвертор ${sys.inverter.brand}` }, lang), st: sys.inverter.stock > 0 ? "in" : "ord" },
    ...((+client.batteryKwh || 0) > 0 ? [{ label: tx({ ro: `Baterie ${sys.battery.brand} ${client.batteryKwh} kWh`, en: `${sys.battery.brand} battery ${client.batteryKwh} kWh`, ru: `Батарея ${sys.battery.brand} ${client.batteryKwh} кВт·ч` }, lang), st: battReady ? "in" : "arr" }] : []),
    { label: tx({ ro: `Structură montaj ${sys.mount.brand}`, en: `${sys.mount.brand} mounting`, ru: `Крепёж ${sys.mount.brand}` }, lang), st: "in" },
    { label: tx({ ro: "Cablu DC/AC + protecții", en: "DC/AC cable + protections", ru: "Кабель DC/AC + защиты" }, lang), st: "in" },
  ];
  const allReady = mats.every((m) => m.st === "in");

  const FIELD_STEPS = ["fld_arrive", "fld_mount", "fld_dc", "fld_ac", "fld_test"];
  const doneN = FIELD_STEPS.filter((s) => steps[s]).length;

  // Concrete commissioning measurements, derived from the system so they read as
  // real test results rather than boilerplate: string layout → string Voc, and a
  // set of measured-vs-limit electrical checks per SR EN 50549-1 / IEC 60364-6.
  const dcKw = (modules * panel.watt) / 1000;
  const strings = Math.max(1, Math.round(dcKw / 5.5));
  const mps = Math.ceil(modules / strings);
  const stringVoc = Math.round(mps * panel.voc * 1.03); // ~ +3% cold-morning margin
  const dateLoc = lang === "ru" ? "ru-RU" : lang === "en" ? "en-IE" : "ro-RO";
  const measRows = [
    [tx({ ro: "Rezistență de izolație DC (Riso)", en: "DC insulation resistance (Riso)", ru: "Сопротивление изоляции DC (Riso)" }, lang), "> 1 MΩ", "18 MΩ", true],
    [tx({ ro: `Tensiune șir Voc (${strings} × ${mps} module)`, en: `String Voc (${strings} × ${mps} modules)`, ru: `Voc цепочки (${strings} × ${mps})` }, lang), `≤ ${client.phases === 3 ? 800 : 500} V`, `${stringVoc} V`, stringVoc <= (client.phases === 3 ? 800 : 500)],
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

  // The week is editable and saved in this browser — schedule the active client
  // on a day with a crew, or remove an install.
  const [installs, setInstalls] = useState(SCHED);
  const [plan, setPlan] = useState({ day: 4, crew: 0 });
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("voltmira_studio_week") || "null"); if (Array.isArray(s)) setInstalls(s); } catch { /* private mode */ }
  }, []);
  const persistWeek = (n) => { setInstalls(n); try { localStorage.setItem("voltmira_studio_week", JSON.stringify(n)); } catch { /* private mode */ } };
  const addActive = () => persistWeek([...installs, { day: +plan.day, client: client.name, loc: String(client.address).split(",")[0], kw: +(+client.kw || 0).toFixed(1), crew: +plan.crew }]);
  const delInstall = (idx) => persistWeek(installs.filter((_, i) => i !== idx));

  return (
    <>
      <PreviewHeader slug="schedule" lang={lang} title={T(TX.title)} sub={T(TX.sub)}
        right={<button className="btn ghost sm" onClick={() => downloadStudioDoc("proces-verbal-" + (client.ref || "voltmira"))}>{tx({ en: "Handover certificate", ro: "Proces-verbal PDF", ru: "Акт приёмки PDF" }, lang)}</button>} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      {/* week calendar */}
      <div className="pv-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{T(TX.week)}</h3>
          <select className="cl-preset" value={plan.day} onChange={(e) => setPlan((p) => ({ ...p, day: +e.target.value }))}>
            {days.map((d, di) => <option key={di} value={di}>{d}</option>)}
          </select>
          <select className="cl-preset" value={plan.crew} onChange={(e) => setPlan((p) => ({ ...p, crew: +e.target.value }))}>
            {CREWS.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
          </select>
          <button className="btn primary sm" onClick={addActive}>+ {tx({ ro: "Programează clientul activ", en: "Schedule active client", ru: "Запланировать клиента" }, lang)}</button>
        </div>
        <div className="sc-week">
          {days.map((d, di) => (
            <div key={di} className="sc-day">
              <div className="sc-day-h">{d}</div>
              {installs.map((s, i) => [s, i]).filter(([s]) => s.day === di).map(([s, i]) => (
                <div key={i} className="sc-job" style={{ borderLeftColor: CREWS[s.crew]?.color || "var(--green)" }}>
                  <button className="sc-job-x" title={tx({ ro: "elimină", en: "remove", ru: "убрать" }, lang)} onClick={() => delInstall(i)}>×</button>
                  <b>{s.client}</b>
                  <span>{s.loc} · {s.kw} kW</span>
                  <em>{CREWS[s.crew]?.name || "—"}</em>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* crews + materials */}
      <div className="pv-2col">
        <div className="pv-panel" style={{ margin: 0 }}>
          <h3>{T(TX.crews)}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {CREWS.map((c, i) => (
              <div key={i} className="sc-crew">
                <span className="sc-dot" style={{ background: c.color }} />
                <div><b>{c.name}</b><div style={{ fontSize: 12, color: "var(--muted)" }}>{c.who}</div></div>
                <span className="sc-crew-n">{tx({ ...TX.jobsN }, lang).replace("{n}", installs.filter((s) => s.crew === i).length)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pv-panel" style={{ margin: 0 }}>
          <h3>{T(TX.materials)} {client.name}</h3>
          <ul className="sc-mats">
            {mats.map((m, i) => (
              <li key={i}>
                <span className={"sc-mst " + (m.st === "in" ? "in" : m.st === "arr" ? "arr" : "ord")}>
                  {m.st === "in" ? "✓" : m.st === "arr" ? "→" : "!"}
                </span>
                {m.label}
                <em>{m.st === "in" ? T(TX.inStock) : m.st === "arr" ? tx({ ...TX.arriving }, lang).replace("{d}", lang === "ro" ? "joi" : lang === "ru" ? "чт" : "Thu") : T(TX.toOrder)}</em>
              </li>
            ))}
          </ul>
          <div className={"qt-flag " + (allReady ? "ok" : "bad")}>{allReady ? T(TX.ready) : T(TX.waiting)}</div>
        </div>
      </div>

      {/* field mode phone */}
      <div className="pv-panel">
        <h3>{T(TX.field)}</h3>
        <div className="sc-phone-wrap">
          <div className="sc-phone">
            <div className="sc-phone-bar">{T(TX.offline)}</div>
            <div className="sc-phone-body">
              <div className="sc-phone-t">{client.name} · {kw.toFixed(1)} kW · {doneN}/5</div>
              {FIELD_STEPS.map((s) => (
                <button key={s} className={"sc-step" + (steps[s] ? " on" : "")}
                  onClick={() => toggleStep(s)}>
                  <span>{steps[s] ? "✓" : ""}</span>{T(TX[s])}
                </button>
              ))}
              <div className="sc-phone-t" style={{ marginTop: 12 }}>{T(TX.fld_photos)} · 6</div>
              <div className="sc-thumbs">{[0, 1, 2, 3].map((i) => <div key={i} className="sc-thumb" />)}</div>
              <button className={"sc-sign" + (signed ? " on" : "")} onClick={toggleSigned}>
                {signed ? "✓ " + T(TX.fld_signed) : T(TX.fld_sign) + " — " + T(TX.tap)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* The deliverable this stage produces: the signed commissioning /
          handover certificate. "Handover certificate" exports just this .pv-doc,
          filled from the field checklist above. */}
      <div className="pv-doc-scroll">
        <div className="pv-doc">
          <div className="doc-co">VoltMira · {new Date().toLocaleDateString(dateLoc)} · {tx({ ro: "proces-verbal de recepție", en: "commissioning record", ru: "акт приёмки" }, lang)}</div>
          <h1>{tx({ ro: "Proces-verbal de punere în funcțiune", en: "Commissioning & handover certificate", ru: "Акт ввода в эксплуатацию и приёмки" }, lang)}</h1>
          <p className="doc-sub">{client.name}{client.address ? " · " + client.address : ""}</p>
          <div className="doc-grid" style={{ marginTop: 10 }}>
            <div className="doc-kv"><span>{tx({ ro: "Nr. proces-verbal", en: "Certificate no.", ru: "№ акта" }, lang)}</span><b>PV-{(client.ref || "VM-2026").replace(/^VM-?/, "")}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Nr. contract", en: "Contract no.", ru: "№ договора" }, lang)}</span><b>{client.contractNo || "—"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Data recepției", en: "Handover date", ru: "Дата приёмки" }, lang)}</span><b>{new Date().toLocaleDateString(dateLoc)}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Loc", en: "Place", ru: "Место" }, lang)}</span><b>{String(client.address || "").split(",").slice(-1)[0].trim() || "—"}</b></div>
          </div>

          <h2>{tx({ ro: "Părți", en: "Parties", ru: "Стороны" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Instalator", en: "Installer", ru: "Установщик" }, lang)}</span><b>VoltMira SRL</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Atestat", en: "Licence", ru: "Аттестат" }, lang)}</span><b>{client.atestat || "ANRE-MC"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Beneficiar", en: "Beneficiary", ru: "Получатель" }, lang)}</span><b>{client.name}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Echipa de montaj", en: "Install crew", ru: "Бригада" }, lang)}</span><b>{CREWS[0].who}</b></div>
          </div>

          <h2>{tx({ ro: "Instalația", en: "The installation", ru: "Установка" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Putere instalată", en: "Installed power", ru: "Мощность" }, lang)}</span><b>{kw.toFixed(1)} kW{(+client.batteryKwh || 0) > 0 ? ` · ${client.batteryKwh} kWh` : ""}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Module", en: "Modules", ru: "Модули" }, lang)}</span><b>{modules} × {panel.watt} W · {panel.brand}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Invertor", en: "Inverter", ru: "Инвертор" }, lang)}</span><b>{sys.inverter.brand} · {client.phases === 3 ? "3~ 400 V" : "1~ 230 V"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Structură de montaj", en: "Mounting", ru: "Крепёж" }, lang)}</span><b>{sys.mount.brand}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Configurație șiruri", en: "String layout", ru: "Схема цепочек" }, lang)}</span><b>{strings} × {mps} {tx({ ro: "module", en: "modules", ru: "модулей" }, lang)}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Contor", en: "Meter", ru: "Счётчик" }, lang)}</span><b>{tx({ ro: "bidirecțional, 4 cadrane", en: "bidirectional, 4-quadrant", ru: "двунаправленный" }, lang)}</b></div>
          </div>

          <h2>{tx({ ro: "Verificări la punere în funcțiune", en: "Commissioning checks", ru: "Проверки при вводе" }, lang)}</h2>
          <table>
            <tbody>
              {FIELD_STEPS.map((s) => (
                <tr key={s}>
                  <td>{T(TX[s])}</td>
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
            <div>{signed ? client.name + tx({ ro: " — semnat pe teren", en: " — signed on site", ru: " — подписано на объекте" }, lang) : tx({ ro: "Beneficiar (nume, semnătură)", en: "Beneficiary (name, signature)", ru: "Получатель (имя, подпись)" }, lang)}</div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sc-week{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        @media(max-width:720px){.sc-week{grid-template-columns:repeat(2,1fr)}}
        .sc-day{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:8px;min-height:96px;display:flex;flex-direction:column;gap:6px}
        .sc-day-h{font-family:var(--font-m,monospace);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
        .sc-job{background:var(--paper-2);border:1px solid var(--line);border-left:3px solid var(--green);border-radius:7px;padding:7px 8px}
        .sc-job{position:relative}
        .sc-job b{display:block;font-size:12px;font-weight:700;color:var(--ink);line-height:1.25;padding-right:14px}
        .sc-job span{display:block;font-size:10.5px;color:var(--muted);margin-top:1px}
        .sc-job em{display:block;font-size:10px;font-style:normal;color:var(--green);margin-top:3px;font-weight:600}
        .sc-job-x{position:absolute;top:4px;right:4px;border:none;background:none;color:var(--muted);font-size:14px;line-height:1;
          cursor:pointer;padding:2px 4px;border-radius:5px}
        .sc-job-x:hover{color:var(--red);background:var(--red-tint)}
        .sc-job-new{border-style:dashed}
        .sc-crew{display:flex;gap:10px;align-items:center;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
        .sc-dot{width:9px;height:9px;border-radius:50%;flex:none}
        .sc-crew > div{flex:1}.sc-crew b{font-size:13px}
        .sc-crew-n{font-family:var(--font-m,monospace);font-size:11px;color:var(--muted)}
        .sc-mats{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}
        .sc-mats li{display:flex;gap:9px;align-items:center;font-size:12.5px;color:var(--ink)}
        .sc-mats li em{margin-left:auto;font-style:normal;font-size:11px;color:var(--muted)}
        .sc-mst{flex:none;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700}
        .sc-mst.in{background:var(--green-tint);color:var(--green)}
        .sc-mst.arr{background:var(--blue-tint,var(--paper-3));color:var(--blue,#2C6E9B)}
        .sc-mst.ord{background:var(--amber-tint);color:#B4472F}
        .qt-flag{border-radius:9px;padding:10px 13px;font-size:12.5px;font-weight:600}
        .qt-flag.ok{background:var(--green-tint);color:var(--green)}
        .qt-flag.bad{background:var(--amber-tint);color:#B4700F}
        .sc-phone-wrap{display:flex;justify-content:center}
        .sc-phone{width:280px;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:var(--paper-2);box-shadow:var(--shadow)}
        .sc-phone-bar{background:var(--amber-tint);color:#B4700F;font-size:10.5px;font-weight:600;text-align:center;padding:7px 10px;line-height:1.4}
        .sc-phone-body{padding:14px}
        .sc-phone-t{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px}
        .sc-step{display:flex;align-items:center;gap:10px;width:100%;text-align:left;font-family:inherit;font-size:13px;font-weight:500;
          color:var(--ink);background:none;border:none;border-top:1px solid var(--line);padding:11px 2px;cursor:pointer}
        .sc-step > span{flex:none;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line);display:grid;place-items:center;
          font-size:12px;font-weight:700;color:#fff}
        .sc-step.on > span{background:var(--green);border-color:var(--green)}
        .sc-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:12px}
        .sc-thumb{aspect-ratio:1;border-radius:6px;background:linear-gradient(135deg,var(--paper),var(--green-tint));border:1px solid var(--line)}
        .sc-sign{width:100%;font-family:inherit;font-size:12px;font-weight:600;padding:14px;border-radius:10px;border:1.5px dashed var(--line);
          background:var(--paper);color:var(--muted);cursor:pointer}
        .sc-sign.on{border-style:solid;border-color:var(--green);background:var(--green-tint);color:var(--green)}
        /* handover-document helpers (selectors carry .pv-doc so they travel into the PDF) */
        .pv-doc td.r,.pv-doc th.r{text-align:right;font-variant-numeric:tabular-nums}
        .pv-doc td.dim{color:#777;font-size:10.5px}
        .pv-doc .doc-list{margin:2px 0 6px;padding-left:18px;font-size:11.5px;color:#333;line-height:1.6}
        .pv-doc .doc-list li{margin:0 0 2px}
      ` }} />
    </>
  );
}
