"use client";
// Studio · Fleet monitoring.
// After handover: real production against the P50 you promised, per-component
// warranty with reminders, and a service-ticket log. Mock inverter data; the
// P50 line is the engine.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, seeded, downloadStudioDoc,
  useStudioClient, ClientBar, engineSettings,
} from "../studio-kit.jsx";
import { simulate, SOLAR_SEASON, effectiveYield } from "../_engine.js";

const TX = {
  title: { en: "Fleet monitoring", ro: "Monitorizare parc", ru: "Мониторинг парка" },
  sub: {
    en: "Real kWh from the inverter portal against the P50 estimate you promised — plus warranties, service tickets, and the regional data that comes out the other side.",
    ro: "kWh reali din portalul invertorului față de estimarea P50 promisă — plus garanții, tichete de service, și datele regionale care ies pe partea cealaltă.",
    ru: "Реальные кВт·ч из портала инвертора против обещанного P50 — плюс гарантии, сервисные заявки и региональные данные на выходе.",
  },
  note: {
    en: "Enter each month's real kWh (from the Deye/Solarman, Huawei FusionSolar or SolarEdge portal) below — it's saved in this browser per client and drives the chart and the report. The P50 line is the same engine that built the quote, so every month is a live honesty check.",
    ro: "Introdu mai jos kWh reali ai fiecărei luni (din portalul Deye/Solarman, Huawei FusionSolar sau SolarEdge) — se salvează în acest browser pe client și alimentează graficul și raportul. Linia P50 e același motor care a făcut oferta, deci fiecare lună e o verificare de onestitate.",
    ru: "Введите ниже реальные кВт·ч каждого месяца (из портала Deye/Solarman, Huawei FusionSolar или SolarEdge) — сохраняется в этом браузере по клиенту и питает график и отчёт. Линия P50 — тот же движок, что делал расчёт.",
  },
  enterActual: { en: "Actual production — enter kWh per month", ro: "Producție reală — introdu kWh pe lună", ru: "Факт выработки — введите кВт·ч за месяц" },
  loadSample: { en: "Fill with a realistic sample", ro: "Completează cu un exemplu realist", ru: "Заполнить примером" },
  clearAll: { en: "Clear", ro: "Golește", ru: "Очистить" },
  noData: { en: "No readings yet — enter a month's kWh below, or load a sample.", ro: "Încă fără citiri — introdu kWh pentru o lună mai jos, sau încarcă un exemplu.", ru: "Пока нет данных — введите кВт·ч за месяц ниже или загрузите пример." },
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
};

const MONTHS = { ro: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"] };
// The installed jobs from the payments ledger, now generating service tickets.
const TICKETS = [
  { client: "Elena Ciobanu", issue: { ro: "Invertor — eroare F13 (izolație)", en: "Inverter — F13 fault (isolation)", ru: "Инвертор — ошибка F13 (изоляция)" }, open: true },
  { client: "Familia Ceban", issue: { ro: "Șir 2 sub producție — verificat, conector", en: "String 2 underproducing — checked, connector", ru: "Цепочка 2 недовырабатывает — разъём" }, open: false },
  { client: "Vasile Rotaru", issue: { ro: "Wi-Fi datalogger reconfigurat", en: "Datalogger Wi-Fi reconfigured", ru: "Wi-Fi даталоггера перенастроен" }, open: false },
];

export default function MonitoringPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Fleet monitoring — VoltMira Studio"; }, []);

  const months = MONTHS[lang] || MONTHS.en;

  // Per-client actual monthly production (kWh), entered by the installer and saved
  // in this browser — this is what makes the report real, not a demo example.
  const actKey = "voltmira_studio_actuals_" + (String(client.ref || client.contractNo || "default").replace(/[^\w-]/g, "") || "default");
  const [actuals, setActuals] = useState(Array(12).fill(""));
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(actKey) || "null");
      setActuals(Array.isArray(s) && s.length === 12 ? s : Array(12).fill(""));
    } catch { setActuals(Array(12).fill("")); }
  }, [actKey]);
  const saveActuals = (next) => {
    setActuals(next);
    try { localStorage.setItem(actKey, JSON.stringify(next)); } catch { /* private mode */ }
  };
  const setMonth = (i, v) => { const n = actuals.slice(); n[i] = v; saveActuals(n); };

  const p50Row = useMemo(() => {
    const E = engineSettings();
    const sim = simulate({
      market: client.market, kw: +client.kw || 0, price: +client.price || 0.185,
      cons: +client.cons || 0, batt: false, yieldOverride: effectiveYield(client),
    }, E, "expc");
    const seasonSum = SOLAR_SEASON.reduce((a, b) => a + b, 0);
    return SOLAR_SEASON.map((f) => (sim.prod0 * f) / seasonSum);
  }, [client]);

  const data = useMemo(() => {
    const rows = p50Row.map((p50, i) => {
      const raw = actuals[i];
      const actual = raw === "" || raw == null || isNaN(+raw) ? null : +raw;
      return { i, p50, actual };
    });
    const filled = rows.filter((r) => r.actual != null);
    const ytdP50 = filled.reduce((a, r) => a + r.p50, 0);
    const ytdAct = filled.reduce((a, r) => a + r.actual, 0);
    const lastMonth = filled.length ? filled[filled.length - 1] : null;
    return { rows, filled, ytdP50, ytdAct, pct: ytdP50 > 0 ? Math.round((ytdAct / ytdP50) * 100) : 0, lastMonth };
  }, [p50Row, actuals]);

  // A realistic starting set the installer can then edit — first 8 months around P50.
  const loadSample = () => {
    const rnd = seeded(Math.round((+client.kw || 6) * 97) + 13);
    saveActuals(p50Row.map((p50, i) => (i <= 7 ? String(Math.round(p50 * (0.90 + rnd() * 0.22))) : "")));
  };

  const maxV = Math.max(1, ...data.rows.map((r) => Math.max(r.p50, r.actual || 0)));

  return (
    <>
      <PreviewHeader slug="monitoring" lang={lang} title={T(TX.title)} sub={T(TX.sub)}
        right={<button className="btn ghost sm" onClick={() => downloadStudioDoc("raport-performanta-" + (client.ref || "voltmira"))}>{tx({ en: "Performance report", ro: "Raport PDF", ru: "Отчёт PDF" }, lang)}</button>} />
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
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{T(TX.ytd)}: <b style={{ color: data.filled.length === 0 ? "var(--muted)" : data.pct >= 100 ? "var(--green)" : "#B4700F" }}>{data.filled.length === 0 ? "—" : `${data.pct}% ${T(TX.ofP50)}`}</b></span>
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

        {/* editable per-month actuals — saved in this browser per client */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "18px 0 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--muted)", flex: 1 }}>{T(TX.enterActual)}</div>
          <button className="btn ghost sm" onClick={loadSample}>{T(TX.loadSample)}</button>
          <button className="btn ghost sm" onClick={() => saveActuals(Array(12).fill(""))}>{T(TX.clearAll)}</button>
        </div>
        <div className="mn-entry">
          {months.map((m, i) => (
            <label key={i} className="mn-in">
              <span>{m}</span>
              <input type="number" min="0" inputMode="numeric" placeholder="—" value={actuals[i]}
                onChange={(e) => setMonth(i, e.target.value)} />
            </label>
          ))}
        </div>
        {data.filled.length === 0 && <p className="pv-mocknote" style={{ marginTop: 12 }}>{T(TX.noData)}</p>}
      </div>

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

      {/* The deliverable: an annual performance report (real vs the promised P50)
          the installer sends the client. "Performance report" exports this .pv-doc. */}
      <div className="pv-doc-scroll">
        <div className="pv-doc">
          <div className="doc-co">VoltMira · {new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-IE" : "ro-RO")} · {tx({ ro: "raport de performanță", en: "performance report", ru: "отчёт о производительности" }, lang)}</div>
          <h1>{tx({ ro: "Raport de performanță", en: "Performance report", ru: "Отчёт о производительности" }, lang)}</h1>
          <p className="doc-sub">{client.name} · {(+client.kw || 0).toFixed(1)} kW</p>

          <h2>{tx({ ro: "Producție reală față de P50", en: "Actual production vs P50", ru: "Факт против P50" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Producție reală (an curent)", en: "Actual (year to date)", ru: "Факт (с начала года)" }, lang)}</span><b>{NUM(data.ytdAct)} kWh</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Estimare P50 (an curent)", en: "P50 estimate (YTD)", ru: "Оценка P50 (с начала года)" }, lang)}</span><b>{NUM(data.ytdP50)} kWh</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Realizat din P50", en: "Delivered vs P50", ru: "Выполнено от P50" }, lang)}</span><b style={{ color: data.filled.length === 0 ? "#777" : data.pct >= 100 ? "var(--green)" : "#B4700F" }}>{data.filled.length === 0 ? "—" : data.pct + "%"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Ultima lună", en: "Last month", ru: "Последний месяц" }, lang)}</span><b>{data.lastMonth ? months[data.lastMonth.i] + ": " + NUM(data.lastMonth.actual) + " kWh" : "—"}</b></div>
          </div>

          <h2>{tx({ ro: "Lunar (MWh)", en: "Monthly (MWh)", ru: "Помесячно (МВт·ч)" }, lang)}</h2>
          <table>
            <thead><tr><th>{tx({ ro: "Luna", en: "Month", ru: "Месяц" }, lang)}</th><th>{tx({ ro: "P50", en: "P50", ru: "P50" }, lang)}</th><th>{tx({ ro: "Real", en: "Actual", ru: "Факт" }, lang)}</th><th>{tx({ ro: "vs P50", en: "vs P50", ru: "vs P50" }, lang)}</th></tr></thead>
            <tbody>
              {data.rows.filter((r) => r.actual != null).map((r) => (
                <tr key={r.i}>
                  <td>{months[r.i]}</td>
                  <td>{(r.p50 / 1000).toFixed(2)}</td>
                  <td>{(r.actual / 1000).toFixed(2)}</td>
                  <td><b style={{ color: r.actual >= r.p50 ? "var(--green)" : "#B4700F" }}>{Math.round((r.actual / r.p50) * 100)}%</b></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>{tx({ ro: "Garanții", en: "Warranties", ru: "Гарантии" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{T(TX.w_work)}</span><b>{T(TX.until)} 2028</b></div>
            <div className="doc-kv"><span>{T(TX.w_inv)}</span><b>{T(TX.until)} 2036</b></div>
            <div className="doc-kv"><span>{T(TX.w_panel)}</span><b>{T(TX.until)} 2051</b></div>
          </div>
          <p className="doc-note">{tx({
            ro: "Producția reală vine din portalul invertorului; linia P50 este aceeași estimare din ofertă. Un sistem sănătos oscilează în jurul valorii de 100% pe an, cu sezonalitate lunară.",
            en: "Actual production is pulled from the inverter portal; the P50 line is the same estimate from the original quote. A healthy system tracks around 100% over the year, with monthly seasonality.",
            ru: "Факт берётся из портала инвертора; линия P50 — та же оценка из расчёта. Здоровая система держится около 100% за год с помесячной сезонностью.",
          }, lang)}</p>
        </div>
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
        .mn-entry{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
        @media(max-width:640px){.mn-entry{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:420px){.mn-entry{grid-template-columns:repeat(3,1fr)}}
        .mn-in{display:flex;flex-direction:column;gap:4px}
        .mn-in span{font-family:var(--font-m,monospace);font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
        .mn-in input{width:100%;background:var(--paper-2);border:1px solid var(--line);border-radius:8px;padding:7px 8px;font-size:12.5px;font-family:inherit;color:var(--ink)}
        .mn-in input:focus{border-color:var(--green);outline:none;box-shadow:0 0 0 3px rgba(30,107,78,.12)}
      ` }} />
    </>
  );
}
