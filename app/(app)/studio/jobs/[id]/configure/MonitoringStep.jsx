"use client";
// MonitoringStep.jsx — this job after handover: monthly production against
// the P50 its quote promised (typed in, or filled nightly from a linked
// inverter portal), warranty terms and per-job service tickets. `touch` tells
// the workspace a reading was saved, so the journey line updates at once.
import { useMemo, useState } from "react";
import { Plus, Wrench, FileText, AlertTriangle, ClipboardList, ShieldCheck, BarChart3, CheckCircle2 } from "lucide-react";
import {
  tx, NUM, seeded, downloadStudioDoc, DocReveal, useToast,
  actualsKey, readJSON, writeJSON,
  loadTickets, addTicket, toggleTicket,
} from "../../../studio-kit.jsx";
import { p50Row } from "../../../fleet-data.js";
import Accordion from "./Accordion.jsx";

const MONTHS = { ro: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"] };

export default function MonitoringStep({ job, lang, touch = () => {} }) {
  const t = (o) => tx(o, lang);
  const [toast, fire] = useToast();
  const months = MONTHS[lang] || MONTHS.en;

  const actKey = actualsKey(job.id);
  const [actuals, setActuals] = useState(() => {
    const s = readJSON(actKey, null);
    return Array.isArray(s) && s.length === 12 ? s : Array(12).fill("");
  });
  const saveActuals = (next) => { setActuals(next); writeJSON(actKey, next); touch(); };
  const setMonth = (i, v) => { const n = actuals.slice(); n[i] = v; saveActuals(n); };

  const [tickets, setTickets] = useState(() => loadTickets(job.id));
  const [ticketText, setTicketText] = useState("");
  function submitTicket() {
    if (!ticketText.trim()) return;
    setTickets(addTicket(job.id, ticketText.trim()));
    setTicketText("");
    fire(t({ en: "Ticket added", ro: "Tichet adăugat", ru: "Заявка добавлена" }));
  }
  function flipTicket(id) { setTickets(toggleTicket(job.id, id)); }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const p50s = useMemo(() => p50Row(job), [job.market, job.kw, job.price, job.cons, job.roofFactor]);

  const data = useMemo(() => {
    const rows = p50s.map((p50, i) => {
      const raw = actuals[i];
      const actual = raw === "" || raw == null || isNaN(+raw) ? null : +raw;
      return { i, p50, actual };
    });
    const filled = rows.filter((r) => r.actual != null);
    const ytdP50 = filled.reduce((a, r) => a + r.p50, 0);
    const ytdAct = filled.reduce((a, r) => a + r.actual, 0);
    const lastMonth = filled.length ? filled[filled.length - 1] : null;
    return { rows, filled, ytdP50, ytdAct, pct: ytdP50 > 0 ? Math.round((ytdAct / ytdP50) * 100) : 0, lastMonth };
  }, [p50s, actuals]);

  const loadSample = () => {
    const rnd = seeded(Math.round((+job.kw || 6) * 97) + 13);
    saveActuals(p50s.map((p50, i) => (i <= 7 ? String(Math.round(p50 * (0.90 + rnd() * 0.22))) : "")));
    fire(t({ en: "Sample readings loaded", ro: "Citiri exemplu încărcate", ru: "Примеры загружены" }));
  };

  const maxV = Math.max(1, ...data.rows.map((r) => Math.max(r.p50, r.actual || 0)));
  const [hoverIdx, setHoverIdx] = useState(null);

  // Real rule-based check, not a modelled/AI call: the most recently entered
  // month is compared against that same month's own P50 (already computed
  // above from the real quote engine) — below 85% flags a banner with the
  // real numbers behind it, so it reads as a finding, not a guess.
  const anomaly = useMemo(() => {
    const m = data.lastMonth;
    if (!m || m.p50 <= 0) return null;
    const ratio = m.actual / m.p50;
    if (ratio >= 0.85) return null;
    return { monthIdx: m.i, p50: m.p50, actual: m.actual, shortfallPct: Math.round((1 - ratio) * 100) };
  }, [data.lastMonth]);

  const ytdGood = data.filled.length > 0 && data.pct >= 100;
  return (
    <>
      {toast}

      {anomaly && (
        <div className="ws-note warn">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <b>{t({ en: `${months[anomaly.monthIdx]} came in ${anomaly.shortfallPct}% below P50.`, ro: `${months[anomaly.monthIdx]}: cu ${anomaly.shortfallPct}% sub P50.`, ru: `${months[anomaly.monthIdx]}: на ${anomaly.shortfallPct}% ниже P50.` })}</b>{" "}
            {t({
              en: `${NUM(anomaly.actual)} kWh against ${NUM(anomaly.p50)} kWh expected. Check for shading, soiling or an inverter fault.`,
              ro: `${NUM(anomaly.actual)} kWh față de ${NUM(anomaly.p50)} kWh estimat. Verifică umbrirea, murdăria de pe panouri sau o defecțiune a invertorului.`,
              ru: `${NUM(anomaly.actual)} кВт·ч против ${NUM(anomaly.p50)} кВт·ч ожидаемых. Проверьте затенение, загрязнение или неисправность инвертора.`,
            })}
          </div>
        </div>
      )}

      <div className="ws-sec">
        <div className="ws-sec-h"><BarChart3 size={16} aria-hidden="true" />{t({ en: "Production against P50", ro: "Producția față de P50", ru: "Выработка против P50" })}
          <span className={"ws-aside " + (data.filled.length === 0 ? "" : ytdGood ? "ws-good" : "ws-bad")}>
            {data.filled.length === 0 ? t({ en: "No readings yet", ro: "Fără citiri încă", ru: "Показаний пока нет" }) : t({ en: `${data.pct}% of P50 this year`, ro: `${data.pct}% din P50 anul acesta`, ru: `${data.pct}% от P50 за год` })}
          </span>
        </div>
        <div className="ws-box" style={{ gap: 10 }}>
          <div className="ws-bars">
            {data.rows.map((r, i) => (
              <div key={i} className="ws-bar" onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}>
                {hoverIdx === i && (
                  <div className="ws-bar-tip">
                    <b>{months[r.i]}</b>
                    P50 {NUM(r.p50)} kWh
                    {r.actual != null && <><br />{t({ en: "Actual", ro: "Real", ru: "Факт" })} {NUM(r.actual)} kWh</>}
                  </div>
                )}
                <div className="ws-bar-in">
                  <span className="p50" style={{ height: (r.p50 / maxV) * 100 + "%" }} />
                  {r.actual != null && <span className={"act" + (r.actual < r.p50 * 0.85 ? " low" : "")} style={{ height: (r.actual / maxV) * 100 + "%" }} />}
                </div>
                <span className="ws-bar-m">{months[r.i]}</span>
              </div>
            ))}
          </div>
          <div className="ws-legend">
            <span><i style={{ background: "var(--line)" }} />{t({ en: "P50, what the quote promised", ro: "P50, ce a promis oferta", ru: "P50, обещано в расчёте" })}</span>
            <span><i style={{ background: "var(--green)" }} />{t({ en: "Actual", ro: "Real", ru: "Факт" })}</span>
          </div>
        </div>
      </div>

      <Accordion title={t({ en: "Monthly readings", ro: "Citiri lunare", ru: "Помесячные показания" })} icon={ClipboardList}
        aside={t({ en: `${data.filled.length} of 12 months`, ro: `${data.filled.length} din 12 luni`, ru: `${data.filled.length} из 12 мес.` })}>
        <p className="ws-sec-note">{t({ en: "The month's kWh from the inverter app. A job linked to an inverter portal in Monitoring fills these in every night.", ro: "kWh-ul lunii din aplicația invertorului. O lucrare legată de un portal de invertor, în Monitorizare, le completează în fiecare noapte.", ru: "кВт·ч за месяц из приложения инвертора. Объект, привязанный к порталу инвертора в разделе «Мониторинг», заполняет их каждую ночь." })}</p>
        <div className="ws-months">
          {months.map((m, i) => (
            <label key={i}>
              {m}
              <input type="number" min="0" inputMode="numeric" placeholder="—" value={actuals[i]} className="ws-input"
                onChange={(e) => setMonth(i, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="ws-actions">
          <button type="button" onClick={loadSample} className="btn ghost sm">{t({ en: "Fill with a realistic sample", ro: "Completează cu un exemplu realist", ru: "Заполнить примером" })}</button>
          <button type="button" onClick={() => { saveActuals(Array(12).fill("")); fire(t({ en: "Readings cleared", ro: "Citiri golite", ru: "Данные очищены" })); }} className="btn ghost sm">
            {t({ en: "Clear", ro: "Golește", ru: "Очистить" })}
          </button>
        </div>
      </Accordion>

      <div className="ws-cols">
        <Accordion title={t({ en: "Warranty", ro: "Garanție", ru: "Гарантия" })} icon={ShieldCheck}>
          <div className="ws-kv">
            <div><span>{t({ en: "Workmanship", ro: "Manoperă", ru: "Работы" })}</span><b>{t({ en: "until", ro: "până în", ru: "до" })} 2028</b></div>
            <div><span>{t({ en: "Inverter", ro: "Invertor", ru: "Инвертор" })}</span><b>{t({ en: "until", ro: "până în", ru: "до" })} 2036</b></div>
            <div><span>{t({ en: "Panels (product)", ro: "Panouri (produs)", ru: "Панели (продукт)" })}</span><b>{t({ en: "until", ro: "până în", ru: "до" })} 2051</b></div>
          </div>
        </Accordion>
        <Accordion title={t({ en: "Service tickets", ro: "Tichete de service", ru: "Сервисные заявки" })} icon={Wrench}
          aside={tickets.some((tk) => tk.open) ? t({ en: `${tickets.filter((tk) => tk.open).length} open`, ro: `${tickets.filter((tk) => tk.open).length} deschise`, ru: `открыто: ${tickets.filter((tk) => tk.open).length}` }) : ""}>
          <div className="ws-row">
            <input value={ticketText} onChange={(e) => setTicketText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitTicket()}
              placeholder={t({ en: "Describe the issue", ro: "Descrie problema", ru: "Опишите проблему" })} className="ws-input ws-grow"
              aria-label={t({ en: "New ticket", ro: "Tichet nou", ru: "Новая заявка" })} />
            <button type="button" onClick={submitTicket} className="btn primary sm" aria-label={t({ en: "Add ticket", ro: "Adaugă tichet", ru: "Добавить заявку" })}><Plus size={15} /></button>
          </div>
          {tickets.length === 0 && <p className="ws-sec-note">{t({ en: "No tickets for this job.", ro: "Niciun tichet pentru această lucrare.", ru: "Нет заявок по этому объекту." })}</p>}
          {tickets.map((tk) => (
            <button key={tk.id} type="button" onClick={() => flipTicket(tk.id)} className={"ws-ticket " + (tk.open ? "open" : "closed")}>
              <span className="ic" aria-hidden="true">{tk.open ? <Wrench size={12} /> : <CheckCircle2 size={12} />}</span>
              <div>
                <b>{tk.issue}</b>
                <small>{tk.open ? t({ en: "Open, tap when resolved", ro: "Deschis, atinge când e rezolvat", ru: "Открыт, нажмите, когда решено" }) : t({ en: "Resolved", ro: "Rezolvat", ru: "Решён" })}</small>
              </div>
            </button>
          ))}
        </Accordion>
      </div>

      <div className="ws-actions">
        <button type="button" onClick={() => downloadStudioDoc("raport-performanta-" + (job.ref || "voltmira"))} className="btn ghost sm">
          <FileText size={15} aria-hidden="true" /> {t({ en: "Performance report: print or PDF", ro: "Raport de performanță: printează sau PDF", ru: "Отчёт о выработке: печать или PDF" })}
        </button>
      </div>

      <DocReveal lang={lang}>
        <div className="pv-doc">
          <div className="doc-co">VoltMira · {new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-IE" : "ro-RO")} · {tx({ ro: "raport de performanță", en: "performance report", ru: "отчёт о производительности" }, lang)}</div>
          <h1>{tx({ ro: "Raport de performanță", en: "Performance report", ru: "Отчёт о производительности" }, lang)}</h1>
          <p className="doc-sub">{job.name} · {(+job.kw || 0).toFixed(1)} kW</p>

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
            <div className="doc-kv"><span>{t({ en: "Workmanship", ro: "Manoperă", ru: "Работы" })}</span><b>{t({ en: "until", ro: "până", ru: "до" })} 2028</b></div>
            <div className="doc-kv"><span>{t({ en: "Inverter", ro: "Invertor", ru: "Инвертор" })}</span><b>{t({ en: "until", ro: "până", ru: "до" })} 2036</b></div>
            <div className="doc-kv"><span>{t({ en: "Panels (product)", ro: "Panouri (produs)", ru: "Панели (продукт)" })}</span><b>{t({ en: "until", ro: "până", ru: "до" })} 2051</b></div>
          </div>
          <p className="doc-note">{tx({
            ro: "Producția reală vine din portalul invertorului; linia P50 este aceeași estimare din ofertă. Un sistem sănătos oscilează în jurul valorii de 100% pe an, cu sezonalitate lunară.",
            en: "Actual production is pulled from the inverter portal; the P50 line is the same estimate from the original quote. A healthy system tracks around 100% over the year, with monthly seasonality.",
            ru: "Факт берётся из портала инвертора; линия P50 — та же оценка из расчёта. Здоровая система держится около 100% за год с помесячной сезонностью.",
          }, lang)}</p>
        </div>
      </DocReveal>
    </>
  );
}
