"use client";
// Studio · Fleet monitoring.
// After handover: real production against the P50 you promised, per-component
// warranty with reminders, and a service-ticket log. Mock inverter data; the
// P50 line is the engine.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, seeded,
  useStudioClient, ClientBar, engineSettings,
} from "../studio-kit.jsx";
import { simulate, SOLAR_SEASON } from "../_engine.js";

const TX = {
  title: { en: "Fleet monitoring", ro: "Monitorizare parc", ru: "Мониторинг парка" },
  sub: {
    en: "Real kWh from the inverter portal against the P50 estimate you promised — plus warranties, service tickets, and the regional data that comes out the other side.",
    ro: "kWh reali din portalul invertorului față de estimarea P50 promisă — plus garanții, tichete de service, și datele regionale care ies pe partea cealaltă.",
    ru: "Реальные кВт·ч из портала инвертора против обещанного P50 — плюс гарантии, сервисные заявки и региональные данные на выходе.",
  },
  note: {
    en: "VoltMira pulls read-only data from Deye/Solarman, Huawei FusionSolar or SolarEdge; the P50 line is the same engine that built the quote, so every month is a live honesty check.",
    ro: "VoltMira ia date read-only din Deye/Solarman, Huawei FusionSolar sau SolarEdge; linia P50 e același motor care a făcut oferta, deci fiecare lună e o verificare de onestitate.",
    ru: "VoltMira тянет read-only данные из Deye/Solarman, Huawei FusionSolar или SolarEdge; линия P50 — тот же движок, что делал расчёт.",
  },
  fleet: { en: "Fleet", ro: "Parc", ru: "Парк" },
  systems: { en: "systems", ro: "sisteme", ru: "систем" },
  totalKw: { en: "total kW", ro: "kW total", ru: "всего кВт" },
  vsP50: { en: "avg vs P50", ro: "medie vs P50", ru: "средн. vs P50" },
  under: { en: "under P90", ro: "sub P90", ru: "ниже P90" },
  prod: { en: "Production vs P50", ro: "Producție vs P50", ru: "Выработка vs P50" },
  ytd: { en: "Year to date", ro: "De la începutul anului", ru: "С начала года" },
  ofP50: { en: "of P50", ro: "din P50", ru: "от P50" },
  actual: { en: "actual", ro: "real", ru: "факт" },
  estimate: { en: "P50 estimate", ro: "estimare P50", ru: "оценка P50" },
  warranty: { en: "Warranty", ro: "Garanție", ru: "Гарантия" },
  w_panel: { en: "Panels (product)", ro: "Panouri (produs)", ru: "Панели (продукт)" },
  w_inv: { en: "Inverter", ro: "Invertor", ru: "Инвертор" },
  w_work: { en: "Workmanship", ro: "Manoperă", ru: "Работы" },
  until: { en: "until", ro: "până", ru: "до" },
  reminder: { en: "reminder in {n} months", ro: "memento în {n} luni", ru: "напоминание через {n} мес." },
  tickets: { en: "Service tickets", ro: "Tichete de service", ru: "Сервисные заявки" },
  open: { en: "open", ro: "deschis", ru: "открыт" },
  resolved: { en: "resolved", ro: "rezolvat", ru: "решён" },
  moat_t: { en: "The data nobody else has", ro: "Datele pe care nu le are nimeni", ru: "Данные, которых нет ни у кого" },
  moat_p: {
    en: "Every monitored system feeds an anonymised Moldova actual-vs-P50 dataset by raion and mounting type. In a country of a few thousand prosumers, that quickly becomes the most defensible yield number in the market.",
    ro: "Fiecare sistem monitorizat alimentează un set anonimizat real-vs-P50 pe Moldova, pe raion și tip de montaj. Într-o țară cu câteva mii de prosumatori, asta devine repede cel mai solid randament de pe piață.",
    ru: "Каждая система в мониторинге пополняет анонимный набор факт-против-P50 по Молдове, по районам и типу монтажа. В стране с несколькими тысячами просьюмеров это быстро становится самым надёжным числом выработки на рынке.",
  },
  msg: { en: "Message the client", ro: "Scrie clientului", ru: "Написать клиенту" },
  msgDone: { en: "Message sent ✓", ro: "Mesaj trimis ✓", ru: "Сообщение отправлено ✓" },
  msgToast: { en: "WhatsApp message queued to the client", ro: "Mesaj WhatsApp pregătit pentru client", ru: "Сообщение WhatsApp подготовлено клиенту" },
  msgTxt: { en: '"Your system produced {k} kWh last month — {p}% of what we estimated. All good."', ro: '„Sistemul tău a produs {k} kWh luna trecută — {p}% din cât am estimat. Totul e în regulă."', ru: '«Ваша система выработала {k} кВт·ч за месяц — {p}% от оценки. Всё хорошо.»' },
};

const MONTHS = { ro: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"] };
const TICKETS = [
  { client: "Familia Rusu", issue: { ro: "Invertor — eroare F13 (izolație)", en: "Inverter — F13 fault (isolation)", ru: "Инвертор — ошибка F13 (изоляция)" }, open: true },
  { client: "Elena C.", issue: { ro: "Șir 2 sub producție — verificat, conector", en: "String 2 underproducing — checked, connector", ru: "Цепочка 2 недовырабатывает — разъём" }, open: false },
  { client: "Familia Ceban", issue: { ro: "Wi-Fi datalogger reconfigurat", en: "Datalogger Wi-Fi reconfigured", ru: "Wi-Fi даталоггера перенастроен" }, open: false },
];

export default function MonitoringPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Fleet monitoring — VoltMira Studio"; }, []);

  const months = MONTHS[lang] || MONTHS.en;
  const nowM = 7; // through August
  const [msgSent, setMsgSent] = useState(false);

  const data = useMemo(() => {
    const E = engineSettings();
    const sim = simulate({
      market: client.market, kw: +client.kw || 0, price: +client.price || 0.185,
      cons: +client.cons || 0, batt: false, yieldOverride: 1235,
    }, E, "expc");
    const seasonSum = SOLAR_SEASON.reduce((a, b) => a + b, 0);
    const rnd = seeded(Math.round((+client.kw || 6) * 97) + 13);
    const rows = SOLAR_SEASON.map((f, i) => {
      const p50 = (sim.prod0 * f) / seasonSum;
      const wob = i <= nowM ? 0.90 + rnd() * 0.22 : null;   // 0.90–1.12
      return { i, p50, actual: wob == null ? null : p50 * wob };
    });
    const ytdP50 = rows.slice(0, nowM + 1).reduce((a, r) => a + r.p50, 0);
    const ytdAct = rows.slice(0, nowM + 1).reduce((a, r) => a + (r.actual || 0), 0);
    const lastMonth = rows[nowM];
    return { rows, ytdP50, ytdAct, pct: Math.round((ytdAct / ytdP50) * 100), lastMonth };
  }, [client]);

  const maxV = Math.max(...data.rows.map((r) => Math.max(r.p50, r.actual || 0)));

  return (
    <>
      <PreviewHeader slug="monitoring" lang={lang} title={T(TX.title)} sub={T(TX.sub)} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      {/* fleet strip */}
      <div className="pv-panel">
        <h3>{T(TX.fleet)}</h3>
        <div className="pv-metrics">
          <div className="pv-metric"><b>38</b><span>{T(TX.systems)}</span></div>
          <div className="pv-metric"><b>312</b><span>{T(TX.totalKw)}</span></div>
          <div className="pv-metric good"><b>103%</b><span>{T(TX.vsP50)}</span></div>
          <div className="pv-metric warn"><b>2</b><span>{T(TX.under)}</span></div>
        </div>
      </div>

      {/* production vs P50 */}
      <div className="pv-panel">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, flex: 1 }}>{T(TX.prod)} · {client.name}</h3>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{T(TX.ytd)}: <b style={{ color: data.pct >= 100 ? "var(--green)" : "#B4700F" }}>{data.pct}% {T(TX.ofP50)}</b></span>
        </div>
        <div className="mn-chart" style={{ marginTop: 14 }}>
          {data.rows.map((r, i) => (
            <div key={i} className="mn-col">
              <div className="mn-bars">
                <i className="mn-p50" style={{ height: (r.p50 / maxV) * 100 + "%" }} />
                {r.actual != null && <i className="mn-act" style={{ height: (r.actual / maxV) * 100 + "%" }} />}
              </div>
              <span>{months[r.i]}</span>
            </div>
          ))}
        </div>
        <div className="mn-legend">
          <span><i className="mn-sw p50" />{T(TX.estimate)}</span>
          <span><i className="mn-sw act" />{T(TX.actual)}</span>
        </div>
        <div className="pv-callout" style={{ marginTop: 14 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 4v16h16M8 14l3-3 3 2 4-6" /></svg>
          <p>{tx(TX.msgTxt, lang).replace("{k}", NUM(data.lastMonth.actual)).replace("{p}", Math.round((data.lastMonth.actual / data.lastMonth.p50) * 100))}
            <button className={"btn sm " + (msgSent ? "primary" : "ghost")} disabled={msgSent} style={{ marginLeft: 10, verticalAlign: "middle" }}
              onClick={() => setMsgSent(true)}>{msgSent ? T(TX.msgDone) : T(TX.msg)}</button></p>
        </div>
      </div>
      {msgSent && <div className="pv-toast show">{T(TX.msgToast)}</div>}

      {/* warranty + tickets */}
      <div className="pv-2col">
        <div className="pv-panel" style={{ margin: 0 }}>
          <h3>{T(TX.warranty)}</h3>
          <ul className="mn-warr">
            <li><span>{T(TX.w_work)}</span><b>{T(TX.until)} 2028</b><em>{tx({ ...TX.reminder }, lang).replace("{n}", 4)}</em></li>
            <li><span>{T(TX.w_inv)}</span><b>{T(TX.until)} 2036</b></li>
            <li><span>{T(TX.w_panel)}</span><b>{T(TX.until)} 2051</b></li>
          </ul>
        </div>
        <div className="pv-panel" style={{ margin: 0 }}>
          <h3>{T(TX.tickets)}</h3>
          <ul className="mn-tix">
            {TICKETS.map((t, i) => (
              <li key={i}>
                <span className={"mn-tst " + (t.open ? "open" : "res")}>{t.open ? T(TX.open) : T(TX.resolved)}</span>
                <div><b>{t.client}</b><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{tx(t.issue, lang)}</div></div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pv-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20" /></svg>
        <div><b>{T(TX.moat_t)}</b><p>{T(TX.moat_p)}</p></div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .mn-chart{display:grid;grid-template-columns:repeat(12,1fr);gap:5px;align-items:end;height:150px}
        .mn-col{display:flex;flex-direction:column;align-items:center;gap:5px;height:100%}
        .mn-bars{flex:1;width:100%;display:flex;gap:2px;align-items:end;justify-content:center}
        .mn-bars i{width:44%;border-radius:3px 3px 0 0;display:block}
        .mn-p50{background:var(--line-strong,#CFD3CD)}
        .mn-act{background:var(--green)}
        .mn-col span{font-family:var(--font-m,monospace);font-size:9px;color:var(--muted)}
        .mn-legend{display:flex;gap:16px;margin-top:8px;font-size:11.5px;color:var(--muted)}
        .mn-legend span{display:inline-flex;align-items:center;gap:6px}
        .mn-sw{width:11px;height:11px;border-radius:3px;display:inline-block}
        .mn-sw.p50{background:var(--line-strong,#CFD3CD)}.mn-sw.act{background:var(--green)}
        .mn-warr{list-style:none;margin:0;padding:0;display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
        .mn-warr li{display:flex;gap:10px;align-items:baseline;background:var(--paper-2);padding:11px 13px;font-size:12.5px}
        .mn-warr li > span{color:var(--muted);flex:1}
        .mn-warr li b{color:var(--ink)}
        .mn-warr li em{font-style:normal;font-size:10.5px;color:#B4700F;flex-basis:100%;text-align:right}
        .mn-tix{list-style:none;margin:0;padding:0;display:grid;gap:9px}
        .mn-tix li{display:flex;gap:10px;align-items:flex-start}
        .mn-tst{flex:none;font-family:var(--font-m,monospace);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
          border-radius:99px;padding:3px 8px;margin-top:1px}
        .mn-tst.open{background:var(--amber-tint);color:#B4472F}
        .mn-tst.res{background:var(--green-tint);color:var(--green)}
      ` }} />
    </>
  );
}
