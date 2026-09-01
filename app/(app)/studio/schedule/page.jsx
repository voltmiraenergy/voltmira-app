"use client";
// Studio · Install schedule.
// The week's installs on a calendar with crews, a materials-ready check against
// the catalog, and a phone view of the on-site checklist + photos + signature
// that works offline. All mock.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote,
  useStudioClient, ClientBar,
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
const SCHED = [
  { day: 0, client: "Familia Rusu", loc: "Ialoveni", kw: 6.5, crew: 0 },
  { day: 1, client: "Elena C.", loc: "Botanica", kw: 8, crew: 1 },
  { day: 2, client: "Hala AgroNord", loc: "Chișinău", kw: 120, crew: 1 },
  { day: 3, client: "Andrei P.", loc: "Strășeni", kw: 5, crew: 0 },
];

export default function SchedulePreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Install schedule — VoltMira Studio"; }, []);

  const days = DAYS[lang] || DAYS.en;
  const [steps, setSteps] = useState({ fld_arrive: true, fld_mount: true, fld_dc: false, fld_ac: false, fld_test: false });
  const [signed, setSigned] = useState(false);

  const kw = +client.kw || 0;
  const modules = Math.max(1, Math.ceil((kw * 1000) / 435));
  const mats = [
    { label: tx({ ro: `Panou 435 W × ${modules}`, en: `435 W panel × ${modules}`, ru: `Панель 435 Вт × ${modules}` }, lang), st: "in" },
    { label: tx({ ro: "Invertor Deye hibrid", en: "Deye hybrid inverter", ru: "Гибридный инвертор Deye" }, lang), st: "in" },
    ...((+client.batteryKwh || 0) > 0 ? [{ label: tx({ ro: `Baterie ${client.batteryKwh} kWh`, en: `Battery ${client.batteryKwh} kWh`, ru: `Батарея ${client.batteryKwh} кВт·ч` }, lang), st: "arr" }] : []),
    { label: tx({ ro: "Structură montaj K2", en: "K2 mounting", ru: "Крепёж K2" }, lang), st: "in" },
    { label: tx({ ro: "Cablu DC/AC + protecții", en: "DC/AC cable + protections", ru: "Кабель DC/AC + защиты" }, lang), st: "in" },
  ];
  const allReady = mats.every((m) => m.st === "in");

  const FIELD_STEPS = ["fld_arrive", "fld_mount", "fld_dc", "fld_ac", "fld_test"];
  const doneN = FIELD_STEPS.filter((s) => steps[s]).length;

  return (
    <>
      <PreviewHeader slug="schedule" lang={lang} title={T(TX.title)} sub={T(TX.sub)} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      {/* week calendar */}
      <div className="pv-panel">
        <h3>{T(TX.week)}</h3>
        <div className="sc-week">
          {days.map((d, di) => (
            <div key={di} className="sc-day">
              <div className="sc-day-h">{d}</div>
              {SCHED.filter((s) => s.day === di).map((s, i) => (
                <div key={i} className="sc-job" style={{ borderLeftColor: CREWS[s.crew].color }}>
                  <b>{s.client}</b>
                  <span>{s.loc} · {s.kw} kW</span>
                  <em>{CREWS[s.crew].name}</em>
                </div>
              ))}
              {di === 4 && (
                <div className="sc-job sc-job-new" style={{ borderLeftColor: "var(--amber)" }}>
                  <b>{client.name}</b><span>{String(client.address).split(",")[0]} · {kw.toFixed(1)} kW</span>
                  <em>{tx({ ro: "de planificat", en: "to schedule", ru: "запланировать" }, lang)}</em>
                </div>
              )}
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
                <span className="sc-crew-n">{tx({ ...TX.jobsN }, lang).replace("{n}", SCHED.filter((s) => s.crew === i).length)}</span>
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
                  onClick={() => setSteps((p) => ({ ...p, [s]: !p[s] }))}>
                  <span>{steps[s] ? "✓" : ""}</span>{T(TX[s])}
                </button>
              ))}
              <div className="sc-phone-t" style={{ marginTop: 12 }}>{T(TX.fld_photos)} · 6</div>
              <div className="sc-thumbs">{[0, 1, 2, 3].map((i) => <div key={i} className="sc-thumb" />)}</div>
              <button className={"sc-sign" + (signed ? " on" : "")} onClick={() => setSigned((v) => !v)}>
                {signed ? "✓ " + T(TX.fld_signed) : T(TX.fld_sign) + " — " + T(TX.tap)}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sc-week{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        @media(max-width:720px){.sc-week{grid-template-columns:repeat(2,1fr)}}
        .sc-day{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:8px;min-height:96px;display:flex;flex-direction:column;gap:6px}
        .sc-day-h{font-family:var(--font-m,monospace);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
        .sc-job{background:var(--paper-2);border:1px solid var(--line);border-left:3px solid var(--green);border-radius:7px;padding:7px 8px}
        .sc-job b{display:block;font-size:12px;font-weight:700;color:var(--ink);line-height:1.25}
        .sc-job span{display:block;font-size:10.5px;color:var(--muted);margin-top:1px}
        .sc-job em{display:block;font-size:10px;font-style:normal;color:var(--green);margin-top:3px;font-weight:600}
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
      ` }} />
    </>
  );
}
