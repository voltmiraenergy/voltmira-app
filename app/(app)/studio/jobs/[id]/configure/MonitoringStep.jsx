"use client";
// MonitoringStep.jsx — this job after handover: monthly production against
// the P50 its quote promised (typed in, or filled nightly from a linked
// inverter portal), warranty terms and per-job service tickets. `touch` tells
// the workspace a reading was saved, so the journey line updates at once.
// Once this year's sunshine at the address is known, each month is judged
// against P50 scaled by that month's sun, exactly as the fleet tab does
// (fleet-data.js); the client's performance report stays on the P50 promised.
import { useMemo, useState } from "react";
import { Plus, Wrench, FileText, AlertTriangle, ClipboardList, ShieldCheck, BarChart3, CheckCircle2 } from "lucide-react";
import {
  tx, NUM, seeded, downloadStudioDoc, DocReveal, useToast,
  actualsKey, readJSON, writeJSON,
  loadTickets, addTicket, toggleTicket,
} from "../../../studio-kit.jsx";
import { p50Row, useSunFactors } from "../../../fleet-data.js";
import Accordion from "./Accordion.jsx";

const MONTHS = { ro: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"], uk: ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"] };

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
    fire(t({ en: "Ticket added", ro: "Tichet adăugat", ru: "Заявка добавлена", uk: "Заявку додано" }));
  }
  function flipTicket(id) { setTickets(toggleTicket(job.id, id)); }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const p50s = useMemo(() => p50Row(job), [job.market, job.kw, job.price, job.cons, job.roofFactor]);

  const sun = useSunFactors([job])[job.id] || null;

  const data = useMemo(() => {
    const rows = p50s.map((p50, i) => {
      const raw = actuals[i];
      const actual = raw === "" || raw == null || isNaN(+raw) ? null : +raw;
      const f = sun?.[i] ?? null;
      // `exp`: what this month should have made under the sky it actually had
      return { i, p50, sun: f, exp: p50 * (f ?? 1), actual };
    });
    const filled = rows.filter((r) => r.actual != null);
    const ytdP50 = filled.reduce((a, r) => a + r.p50, 0);
    const ytdExp = filled.reduce((a, r) => a + r.exp, 0);
    const ytdAct = filled.reduce((a, r) => a + r.actual, 0);
    const lastMonth = filled.length ? filled[filled.length - 1] : null;
    return {
      rows, filled, ytdP50, ytdExp, ytdAct, lastMonth,
      pct: ytdP50 > 0 ? Math.round((ytdAct / ytdP50) * 100) : 0,
      pctExp: ytdExp > 0 ? Math.round((ytdAct / ytdExp) * 100) : 0,
      adjusted: filled.some((r) => r.sun != null),
    };
  }, [p50s, actuals, sun]);

  const loadSample = () => {
    const rnd = seeded(Math.round((+job.kw || 6) * 97) + 13);
    saveActuals(data.rows.map((r, i) => (i <= 7 ? String(Math.round(r.exp * (0.90 + rnd() * 0.22))) : "")));
    fire(t({ en: "Sample readings loaded", ro: "Citiri exemplu încărcate", ru: "Примеры загружены", uk: "Приклади завантажено" }));
  };

  const maxV = Math.max(1, ...data.rows.map((r) => Math.max(r.exp, r.actual || 0)));
  const [hoverIdx, setHoverIdx] = useState(null);

  // Real rule-based check, not a modelled/AI call: the most recently entered
  // month is compared against that same month's own P50 (already computed
  // above from the real quote engine) — below 85% flags a banner with the
  // real numbers behind it, so it reads as a finding, not a guess.
  // With the month's sunshine known, against what that sky allowed, so a
  // cloudy month is not flagged as a fault.
  const anomaly = useMemo(() => {
    const m = data.lastMonth;
    if (!m || m.exp <= 0) return null;
    const ratio = m.actual / m.exp;
    if (ratio >= 0.85) return null;
    return { monthIdx: m.i, p50: m.exp, actual: m.actual, sun: m.sun != null, shortfallPct: Math.round((1 - ratio) * 100) };
  }, [data.lastMonth]);

  const shown = data.adjusted ? data.pctExp : data.pct;
  const ytdGood = data.filled.length > 0 && shown >= 100;
  return (
    <>
      {toast}

      {anomaly && (
        <div className="ws-note warn">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <b>{anomaly.sun
              ? t({ en: `${months[anomaly.monthIdx]} came in ${anomaly.shortfallPct}% below what its sun allowed.`, ro: `${months[anomaly.monthIdx]}: cu ${anomaly.shortfallPct}% sub cât a permis soarele lunii.`, ru: `${months[anomaly.monthIdx]}: на ${anomaly.shortfallPct}% ниже того, что позволило солнце.`, uk: `${months[anomaly.monthIdx]}: на ${anomaly.shortfallPct}% нижче, ніж дозволило сонце.` })
              : t({ en: `${months[anomaly.monthIdx]} came in ${anomaly.shortfallPct}% below P50.`, ro: `${months[anomaly.monthIdx]}: cu ${anomaly.shortfallPct}% sub P50.`, ru: `${months[anomaly.monthIdx]}: на ${anomaly.shortfallPct}% ниже P50.`, uk: `${months[anomaly.monthIdx]}: на ${anomaly.shortfallPct}% нижче P50.` })}</b>{" "}
            {t({
              en: `${NUM(anomaly.actual)} kWh against ${NUM(anomaly.p50)} kWh expected. Check for shading, soiling or an inverter fault.`,
              ro: `${NUM(anomaly.actual)} kWh față de ${NUM(anomaly.p50)} kWh estimat. Verifică umbrirea, murdăria de pe panouri sau o defecțiune a invertorului.`,
              ru: `${NUM(anomaly.actual)} кВт·ч против ${NUM(anomaly.p50)} кВт·ч ожидаемых. Проверьте затенение, загрязнение или неисправность инвертора.`,
              uk: `${NUM(anomaly.actual)} кВт·год проти ${NUM(anomaly.p50)} кВт·год очікуваних. Перевірте затінення, забруднення або несправність інвертора.`,
            })}
          </div>
        </div>
      )}

      <div className="ws-sec">
        <div className="ws-sec-h"><BarChart3 size={16} aria-hidden="true" />{data.adjusted
            ? t({ en: "Production against this year's sun", ro: "Producția față de soarele anului", ru: "Выработка против солнца этого года", uk: "Генерація проти сонця цього року" })
            : t({ en: "Production against P50", ro: "Producția față de P50", ru: "Выработка против P50", uk: "Генерація проти P50" })}
          <span className={"ws-aside " + (data.filled.length === 0 ? "" : ytdGood ? "ws-good" : "ws-bad")}>
            {data.filled.length === 0 ? t({ en: "No readings yet", ro: "Fără citiri încă", ru: "Показаний пока нет", uk: "Показників поки немає" })
              : data.adjusted ? t({ en: `${shown}% of what the sun allowed`, ro: `${shown}% din cât a permis soarele`, ru: `${shown}% от того, что позволило солнце`, uk: `${shown}% від того, що дозволило сонце` })
              : t({ en: `${shown}% of P50 this year`, ro: `${shown}% din P50 anul acesta`, ru: `${shown}% от P50 за год`, uk: `${shown}% від P50 за рік` })}
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
                    {r.sun != null && <><br />{t({ en: "With this year's sun", ro: "Cu soarele de anul acesta", ru: "С солнцем этого года", uk: "Із сонцем цього року" })} {NUM(r.exp)} kWh</>}
                    {r.actual != null && <><br />{t({ en: "Actual", ro: "Real", ru: "Факт", uk: "Факт" })} {NUM(r.actual)} kWh</>}
                  </div>
                )}
                <div className="ws-bar-in">
                  <span className="p50" style={{ height: (r.exp / maxV) * 100 + "%" }} />
                  {r.actual != null && <span className={"act" + (r.actual < r.exp * 0.85 ? " low" : "")} style={{ height: (r.actual / maxV) * 100 + "%" }} />}
                </div>
                <span className="ws-bar-m">{months[r.i]}</span>
              </div>
            ))}
          </div>
          <div className="ws-legend">
            <span><i style={{ background: "var(--line)" }} />{data.adjusted
              ? t({ en: "P50 adjusted for how sunny each month really was (NASA satellite data)", ro: "P50 ajustat după cât de însorită a fost de fapt fiecare lună (date satelitare NASA)", ru: "P50 с поправкой на реальную солнечность каждого месяца (спутниковые данные NASA)", uk: "P50 з поправкою на реальну сонячність кожного місяця (супутникові дані NASA)" })
              : t({ en: "P50, what the quote promised", ro: "P50, ce a promis oferta", ru: "P50, обещано в расчёте", uk: "P50, обіцяне в розрахунку" })}</span>
            <span><i style={{ background: "var(--green)" }} />{t({ en: "Actual", ro: "Real", ru: "Факт", uk: "Факт" })}</span>
          </div>
        </div>
      </div>

      <Accordion title={t({ en: "Monthly readings", ro: "Citiri lunare", ru: "Помесячные показания", uk: "Помісячні показники" })} icon={ClipboardList}
        aside={t({ en: `${data.filled.length} of 12 months`, ro: `${data.filled.length} din 12 luni`, ru: `${data.filled.length} из 12 мес.`, uk: `${data.filled.length} з 12 міс.` })}>
        <p className="ws-sec-note">{t({ en: "The month's kWh from the inverter app. A job linked to an inverter portal in Monitoring fills these in every night.", ro: "kWh-ul lunii din aplicația invertorului. O lucrare legată de un portal de invertor, în Monitorizare, le completează în fiecare noapte.", ru: "кВт·ч за месяц из приложения инвертора. Объект, привязанный к порталу инвертора в разделе «Мониторинг», заполняет их каждую ночь.", uk: "кВт·год за місяць із застосунку інвертора. Об’єкт, прив’язаний до порталу інвертора в розділі «Моніторинг», заповнює їх щоночі." })}</p>
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
          <button type="button" onClick={loadSample} className="btn ghost sm">{t({ en: "Fill with a realistic sample", ro: "Completează cu un exemplu realist", ru: "Заполнить примером", uk: "Заповнити прикладом" })}</button>
          <button type="button" onClick={() => { saveActuals(Array(12).fill("")); fire(t({ en: "Readings cleared", ro: "Citiri golite", ru: "Данные очищены", uk: "Дані очищено" })); }} className="btn ghost sm">
            {t({ en: "Clear", ro: "Golește", ru: "Очистить", uk: "Очистити" })}
          </button>
        </div>
      </Accordion>

      <div className="ws-cols">
        <Accordion title={t({ en: "Warranty", ro: "Garanție", ru: "Гарантия", uk: "Гарантія" })} icon={ShieldCheck}>
          <div className="ws-kv">
            <div><span>{t({ en: "Workmanship", ro: "Manoperă", ru: "Работы", uk: "Роботи" })}</span><b>{t({ en: "until", ro: "până în", ru: "до", uk: "до" })} 2028</b></div>
            <div><span>{t({ en: "Inverter", ro: "Invertor", ru: "Инвертор", uk: "Інвертор" })}</span><b>{t({ en: "until", ro: "până în", ru: "до", uk: "до" })} 2036</b></div>
            <div><span>{t({ en: "Panels (product)", ro: "Panouri (produs)", ru: "Панели (продукт)", uk: "Панелі (продукт)" })}</span><b>{t({ en: "until", ro: "până în", ru: "до", uk: "до" })} 2051</b></div>
          </div>
        </Accordion>
        <Accordion title={t({ en: "Service tickets", ro: "Tichete de service", ru: "Сервисные заявки", uk: "Сервісні заявки" })} icon={Wrench}
          aside={tickets.some((tk) => tk.open) ? t({ en: `${tickets.filter((tk) => tk.open).length} open`, ro: `${tickets.filter((tk) => tk.open).length} deschise`, ru: `открыто: ${tickets.filter((tk) => tk.open).length}`, uk: `відкрито: ${tickets.filter((tk) => tk.open).length}` }) : ""}>
          <div className="ws-row">
            <input value={ticketText} onChange={(e) => setTicketText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitTicket()}
              placeholder={t({ en: "Describe the issue", ro: "Descrie problema", ru: "Опишите проблему", uk: "Опишіть проблему" })} className="ws-input ws-grow"
              aria-label={t({ en: "New ticket", ro: "Tichet nou", ru: "Новая заявка", uk: "Нова заявка" })} />
            <button type="button" onClick={submitTicket} className="btn primary sm" aria-label={t({ en: "Add ticket", ro: "Adaugă tichet", ru: "Добавить заявку", uk: "Додати заявку" })}><Plus size={15} /></button>
          </div>
          {tickets.length === 0 && <p className="ws-sec-note">{t({ en: "No tickets for this job.", ro: "Niciun tichet pentru această lucrare.", ru: "Нет заявок по этому объекту.", uk: "Немає заявок щодо цього об’єкта." })}</p>}
          {tickets.map((tk) => (
            <button key={tk.id} type="button" onClick={() => flipTicket(tk.id)} className={"ws-ticket " + (tk.open ? "open" : "closed")}>
              <span className="ic" aria-hidden="true">{tk.open ? <Wrench size={12} /> : <CheckCircle2 size={12} />}</span>
              <div>
                <b>{tk.issue}</b>
                <small>{tk.open ? t({ en: "Open, tap when resolved", ro: "Deschis, atinge când e rezolvat", ru: "Открыт, нажмите, когда решено", uk: "Відкрита, натисніть, коли вирішено" }) : t({ en: "Resolved", ro: "Rezolvat", ru: "Решён", uk: "Вирішено" })}</small>
              </div>
            </button>
          ))}
        </Accordion>
      </div>

      <div className="ws-actions">
        <button type="button" onClick={() => downloadStudioDoc("raport-performanta-" + (job.ref || "voltmira"))} className="btn ghost sm">
          <FileText size={15} aria-hidden="true" /> {t({ en: "Performance report: print or PDF", ro: "Raport de performanță: printează sau PDF", ru: "Отчёт о выработке: печать или PDF", uk: "Звіт про генерацію: друк або PDF" })}
        </button>
      </div>

      <DocReveal lang={lang}>
        <div className="pv-doc">
          <div className="doc-co">VoltMira, {new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : lang === "uk" ? "uk-UA" : lang === "en" ? "en-IE" : "ro-RO")}, {tx({ ro: "raport de performanță", en: "performance report", ru: "отчёт о производительности", uk: "звіт про продуктивність" }, lang)}</div>
          <h1>{tx({ ro: "Raport de performanță", en: "Performance report", ru: "Отчёт о производительности", uk: "Звіт про продуктивність" }, lang)}</h1>
          <p className="doc-sub">{job.name}, {(+job.kw || 0).toFixed(1)} kW</p>

          <h2>{tx({ ro: "Producție reală față de P50", en: "Actual production vs P50", ru: "Факт против P50", uk: "Факт проти P50" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{tx({ ro: "Producție reală (an curent)", en: "Actual (year to date)", ru: "Факт (с начала года)", uk: "Факт (з початку року)" }, lang)}</span><b>{NUM(data.ytdAct)} kWh</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Estimare P50 (an curent)", en: "P50 estimate (YTD)", ru: "Оценка P50 (с начала года)", uk: "Оцінка P50 (з початку року)" }, lang)}</span><b>{NUM(data.ytdP50)} kWh</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Realizat din P50", en: "Delivered vs P50", ru: "Выполнено от P50", uk: "Виконано від P50" }, lang)}</span><b style={{ color: data.filled.length === 0 ? "#777" : data.pct >= 100 ? "var(--green)" : "#B4700F" }}>{data.filled.length === 0 ? "—" : data.pct + "%"}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Ultima lună", en: "Last month", ru: "Последний месяц", uk: "Останній місяць" }, lang)}</span><b>{data.lastMonth ? months[data.lastMonth.i] + ": " + NUM(data.lastMonth.actual) + " kWh" : "—"}</b></div>
          </div>

          <h2>{tx({ ro: "Lunar (MWh)", en: "Monthly (MWh)", ru: "Помесячно (МВт·ч)", uk: "Помісячно (МВт·год)" }, lang)}</h2>
          <table>
            <thead><tr><th>{tx({ ro: "Luna", en: "Month", ru: "Месяц", uk: "Місяць" }, lang)}</th><th>{tx({ ro: "P50", en: "P50", ru: "P50", uk: "P50" }, lang)}</th><th>{tx({ ro: "Real", en: "Actual", ru: "Факт", uk: "Факт" }, lang)}</th><th>{tx({ ro: "vs P50", en: "vs P50", ru: "vs P50", uk: "vs P50" }, lang)}</th></tr></thead>
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

          <h2>{tx({ ro: "Garanții", en: "Warranties", ru: "Гарантии", uk: "Гарантії" }, lang)}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{t({ en: "Workmanship", ro: "Manoperă", ru: "Работы", uk: "Роботи" })}</span><b>{t({ en: "until", ro: "până", ru: "до", uk: "до" })} 2028</b></div>
            <div className="doc-kv"><span>{t({ en: "Inverter", ro: "Invertor", ru: "Инвертор", uk: "Інвертор" })}</span><b>{t({ en: "until", ro: "până", ru: "до", uk: "до" })} 2036</b></div>
            <div className="doc-kv"><span>{t({ en: "Panels (product)", ro: "Panouri (produs)", ru: "Панели (продукт)", uk: "Панелі (продукт)" })}</span><b>{t({ en: "until", ro: "până", ru: "до", uk: "до" })} 2051</b></div>
          </div>
          <p className="doc-note">{tx({
            ro: "Producția reală vine din portalul invertorului; linia P50 este aceeași estimare din ofertă. Un sistem sănătos oscilează în jurul valorii de 100% pe an, cu sezonalitate lunară.",
            en: "Actual production is pulled from the inverter portal; the P50 line is the same estimate from the original quote. A healthy system tracks around 100% over the year, with monthly seasonality.",
            ru: "Факт берётся из портала инвертора; линия P50, та же оценка из расчёта. Здоровая система держится около 100% за год с помесячной сезонностью.",
            uk: "Факт береться з порталу інвертора; лінія P50 це та сама оцінка з розрахунку. Справна система тримається біля 100% за рік із помісячною сезонністю.",
          }, lang)}</p>
        </div>
      </DocReveal>
    </>
  );
}
