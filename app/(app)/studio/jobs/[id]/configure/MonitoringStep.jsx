"use client";
// MonitoringStep.jsx — absorbs the old standalone Monitoring tool: monthly
// actuals vs the P50 the quote promised, warranty terms, and service tickets.
// The old hardcoded "Fleet" strip (38 systems / 312 kW / ...) is dropped, not
// ported — it was never real at the single-job level this step operates at.
// Tickets are now real and per-job (jobs-data.js), not a fixed list of 3
// names unrelated to whichever job happens to be open.
import { useMemo, useState } from "react";
import { Plus, Wrench, FileText, AlertTriangle, ClipboardList, ShieldCheck } from "lucide-react";
import {
  tx, NUM, seeded, downloadStudioDoc, DocReveal, useToast,
  actualsKey, readJSON, writeJSON,
  loadTickets, addTicket, toggleTicket,
} from "../../../studio-kit.jsx";
import { p50Row } from "../../../fleet-data.js";
import Accordion from "./Accordion.jsx";

const MONTHS = { ro: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"] };

export default function MonitoringStep({ job, lang }) {
  const t = (o) => tx(o, lang);
  const [toast, fire] = useToast();
  const months = MONTHS[lang] || MONTHS.en;

  const actKey = actualsKey(job.id);
  const [actuals, setActuals] = useState(() => {
    const s = readJSON(actKey, null);
    return Array.isArray(s) && s.length === 12 ? s : Array(12).fill("");
  });
  const saveActuals = (next) => { setActuals(next); writeJSON(actKey, next); };
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

  return (
    <div className="space-y-6">
      {toast}

      {anomaly && (
        <div className="flex items-start gap-3 rounded-lg border border-accent-300 bg-accent-50 p-3 dark:border-accent-500/40 dark:bg-accent-500/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-accent-600 dark:text-accent-400" />
          <div className="text-xs">
            <div className="font-semibold text-accent-800 dark:text-accent-300">
              {t({ en: "Production is below P50", ro: "Producția este sub P50", ru: "Выработка ниже P50" })}
            </div>
            <div className="mt-0.5 text-accent-700 dark:text-accent-400">
              {t({
                en: `${months[anomaly.monthIdx]}: ${anomaly.shortfallPct}% below P50 (${NUM(anomaly.actual)} kWh vs ${NUM(anomaly.p50)} kWh expected). Check for shading, soiling, or an inverter fault.`,
                ro: `${months[anomaly.monthIdx]}: cu ${anomaly.shortfallPct}% sub P50 (${NUM(anomaly.actual)} kWh față de ${NUM(anomaly.p50)} kWh estimat). Verifică umbrirea, murdărirea panourilor sau o defecțiune a invertorului.`,
                ru: `${months[anomaly.monthIdx]}: на ${anomaly.shortfallPct}% ниже P50 (${NUM(anomaly.actual)} кВт·ч против ${NUM(anomaly.p50)} кВт·ч ожидаемых). Проверьте затенение, загрязнение панелей или неисправность инвертора.`,
              })}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h3 className="flex-1 text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Production vs P50", ro: "Producție vs P50", ru: "Выработка vs P50" })}</h3>
          <span className="text-xs text-slate-500 dark:text-[#B0B0B0]">
            {t({ en: "Year to date", ro: "De la începutul anului", ru: "С начала года" })}: {" "}
            <b className={data.filled.length === 0 ? "text-slate-400" : data.pct >= 100 ? "text-brand-600 dark:text-brand-400" : "text-accent-600 dark:text-accent-400"}>
              {data.filled.length === 0 ? "—" : `${data.pct}% ${t({ en: "of P50", ro: "din P50", ru: "от P50" })}`}
            </b>
          </span>
        </div>

        <div className="grid grid-cols-12 items-end gap-1" style={{ height: 130 }}>
          {data.rows.map((r, i) => (
            <div key={i} className="relative flex h-full flex-col items-center justify-end gap-1"
              onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}>
              {hoverIdx === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] shadow-lg dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
                  <div className="font-semibold text-slate-700 dark:text-white">{months[r.i]}</div>
                  <div className="text-slate-500 dark:text-[#B0B0B0]">P50: {NUM(r.p50)} kWh</div>
                  {r.actual != null && (
                    <div className="text-brand-600 dark:text-brand-400">
                      {t({ en: "Actual", ro: "Real", ru: "Факт" })}: {NUM(r.actual)} kWh
                    </div>
                  )}
                </div>
              )}
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <span className="w-[44%] rounded-t bg-slate-300 dark:bg-[#383838]" style={{ height: (r.p50 / maxV) * 100 + "%" }} />
                {r.actual != null && <span className="w-[44%] rounded-t bg-brand-500" style={{ height: (r.actual / maxV) * 100 + "%" }} />}
              </div>
              <span className="font-mono text-[9px] text-slate-400">{months[r.i]}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500 dark:text-[#B0B0B0]">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-[#383838]" />{t({ en: "P50 estimate", ro: "estimare P50", ru: "оценка P50" })}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" />{t({ en: "actual", ro: "real", ru: "факт" })}</span>
        </div>

      </div>

      <Accordion title={t({ en: "Monthly actuals", ro: "Citiri lunare", ru: "Помесячные данные" })} icon={ClipboardList}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#B0B0B0]">
            {t({ en: "Enter kWh per month", ro: "Introdu kWh pe lună", ru: "Введите кВт·ч за месяц" })}
          </div>
          <button type="button" onClick={loadSample} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#3A3A3A] dark:text-[#D4D4D4] dark:hover:bg-[#242424]">
            {t({ en: "Fill with a realistic sample", ro: "Completează cu un exemplu realist", ru: "Заполнить примером" })}
          </button>
          <button type="button" onClick={() => { saveActuals(Array(12).fill("")); fire(t({ en: "Readings cleared", ro: "Citiri golite", ru: "Данные очищены" })); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#3A3A3A] dark:text-[#D4D4D4] dark:hover:bg-[#242424]">
            {t({ en: "Clear", ro: "Golește", ru: "Очистить" })}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {months.map((m, i) => (
            <label key={i} className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{m}</span>
              <input type="number" min="0" inputMode="numeric" placeholder="—" value={actuals[i]}
                onChange={(e) => setMonth(i, e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-white" />
            </label>
          ))}
        </div>
        {data.filled.length === 0 && (
          <p className="mt-3 text-xs text-slate-500 dark:text-[#B0B0B0]">
            {t({ en: "No readings yet — enter a month's kWh above, or load a sample.", ro: "Încă fără citiri — introdu kWh pentru o lună mai sus, sau încarcă un exemplu.", ru: "Пока нет данных — введите кВт·ч за месяц выше или загрузите пример." })}
          </p>
        )}
      </Accordion>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Accordion title={t({ en: "Warranty", ro: "Garanție", ru: "Гарантия" })} icon={ShieldCheck}>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-[#242424] dark:border-[#2C2C2C]">
            <div className="flex items-center justify-between px-3 py-2.5 text-xs">
              <span className="text-slate-500 dark:text-[#B0B0B0]">{t({ en: "Workmanship", ro: "Manoperă", ru: "Работы" })}</span>
              <span className="font-semibold text-slate-800 dark:text-white">{t({ en: "until", ro: "până", ru: "до" })} 2028</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-xs">
              <span className="text-slate-500 dark:text-[#B0B0B0]">{t({ en: "Inverter", ro: "Invertor", ru: "Инвертор" })}</span>
              <span className="font-semibold text-slate-800 dark:text-white">{t({ en: "until", ro: "până", ru: "до" })} 2036</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-xs">
              <span className="text-slate-500 dark:text-[#B0B0B0]">{t({ en: "Panels (product)", ro: "Panouri (produs)", ru: "Панели (продукт)" })}</span>
              <span className="font-semibold text-slate-800 dark:text-white">{t({ en: "until", ro: "până", ru: "до" })} 2051</span>
            </div>
          </div>
        </Accordion>
        <Accordion title={t({ en: "Service tickets", ro: "Tichete de service", ru: "Сервисные заявки" })} icon={Wrench}>
          <div className="mb-2 flex gap-2">
            <input value={ticketText} onChange={(e) => setTicketText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitTicket()}
              placeholder={t({ en: "Describe the issue…", ro: "Descrie problema…", ru: "Опишите проблему…" })}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-white" />
            <button type="button" onClick={submitTicket} className="ws-fill-brand flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {tickets.length === 0 && <p className="text-xs text-slate-400">{t({ en: "No tickets for this job.", ro: "Niciun tichet pentru această lucrare.", ru: "Нет заявок по этому объекту." })}</p>}
            {tickets.map((tk) => (
              <button key={tk.id} type="button" onClick={() => flipTicket(tk.id)}
                className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-left dark:border-[#2C2C2C]">
                <span className={"mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full " + (tk.open ? "bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400" : "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400")}>
                  <Wrench className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-800 dark:text-white">{tk.issue}</div>
                  <div className={"text-[10px] font-bold uppercase tracking-wide " + (tk.open ? "text-accent-600 dark:text-accent-400" : "text-brand-600 dark:text-brand-400")}>
                    {tk.open ? t({ en: "open — tap to resolve", ro: "deschis — atinge pentru rezolvare", ru: "открыт — нажмите чтобы закрыть" }) : t({ en: "resolved", ro: "rezolvat", ru: "решён" })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Accordion>
      </div>

      <button type="button" onClick={() => downloadStudioDoc("raport-performanta-" + (job.ref || "voltmira"))}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#3A3A3A] dark:text-[#D4D4D4] dark:hover:bg-[#242424]">
        <FileText className="h-4 w-4" /> {t({ en: "Performance report — Print / PDF", ro: "Raport performanță — Printează / PDF", ru: "Отчёт — Печать / PDF" })}
      </button>

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
    </div>
  );
}
