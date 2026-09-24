"use client";
// app/(app)/studio/monitoring/page.jsx — Fleet monitoring: every system the
// installer has handed over, measured against the P50 its own quote promised.
//
// Three jobs on one screen, in the order an installer needs them:
//   1. What needs a visit, and why (rule-based diagnosis, lib/fleetHealth.js,
//      with the numbers behind every verdict shown next to it).
//   2. How the whole fleet is doing (one row per system).
//   3. A monthly update for the client, ready to send over WhatsApp/Viber —
//      the after-sales touch that keeps a one-off install a relationship.
//
// Readings are the per-job ones the workspace's Monitoring step writes; this
// page keeps no copy of its own.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PREVIEW_BASE } from "../features.js";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, EUR, useStudioJobs, useToast,
  loadTickets, addTicket,
} from "../studio-kit.jsx";
import {
  fleetRows, localLei, isSample, buildSampleFleet, clearJobStorage,
} from "../fleet-data.js";
import { compareUrgency, fleetRatio, THRESH } from "../../../../lib/fleetHealth.js";

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ro: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"],
  ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
};
// Full names for the client message. Russian months are all masculine, so the
// nominative reads correctly after «за» (за август, за май).
const MONTHS_LONG = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ro: ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"],
  ru: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
};

const T = {
  title: { en: "Fleet monitoring", ro: "Monitorizarea parcului", ru: "Мониторинг систем" },
  sub: {
    en: "Every system you've handed over, measured against the P50 its own quote promised. See what needs a visit and why, what each client saved, and send them a monthly update in a tap.",
    ro: "Fiecare sistem predat, măsurat față de P50-ul promis în propria ofertă. Vezi ce are nevoie de o vizită și de ce, cât a economisit fiecare client, și trimite-i un raport lunar dintr-o atingere.",
    ru: "Каждая сданная система против P50 из её собственного расчёта. Что требует выезда и почему, сколько сэкономил каждый клиент, и ежемесячный отчёт клиенту в одно касание.",
  },
  note: {
    en: "Readings come from each job's Monitoring step, where you enter the month's kWh from the inverter app. Automatic sync with inverter portals (Solarman, FusionSolar, SolarEdge) isn't connected yet.",
    ro: "Citirile vin din pasul Monitorizare al fiecărei lucrări, unde introduci kWh-ul lunii din aplicația invertorului. Sincronizarea automată cu portalurile invertoarelor (Solarman, FusionSolar, SolarEdge) nu e conectată încă.",
    ru: "Показания берутся из шага «Мониторинг» каждого объекта, куда вы вносите кВт·ч за месяц из приложения инвертора. Автоматическая синхронизация с порталами инверторов (Solarman, FusionSolar, SolarEdge) пока не подключена.",
  },
  k_systems: { en: "systems handed over", ro: "sisteme predate", ru: "сданных систем" },
  k_ratio: { en: "fleet vs P50 this year (median)", ro: "parcul față de P50 anul acesta (median)", ru: "парк против P50 за год (медиана)" },
  k_energy: { en: "generated this year", ro: "produși anul acesta", ru: "выработано за год" },
  k_saved: { en: "your clients saved this year", ro: "au economisit clienții tăi anul acesta", ru: "сэкономили ваши клиенты за год" },
  k_attention: { en: "need attention", ro: "au nevoie de atenție", ru: "требуют внимания" },
  k_lost: { en: "below P50 on flagged systems", ro: "sub P50 la sistemele semnalate", ru: "ниже P50 на проблемных системах" },
  queue: { en: "Needs attention", ro: "Au nevoie de atenție", ru: "Требуют внимания" },
  queueNone: { en: "Nothing needs a visit. Every system with a reading for {m} is within 15% of its P50.", ro: "Nimic nu necesită o vizită. Toate sistemele cu citire pentru {m} sunt la cel mult 15% sub P50.", ru: "Выезд не нужен. Все системы с показаниями за {m} в пределах 15% от P50." },
  whatToDo: { en: "What to do", ro: "Ce faci", ru: "Что делать" },
  logTicket: { en: "Log service ticket", ro: "Deschide tichet de service", ru: "Создать сервисную заявку" },
  ticketLogged: { en: "Ticket logged", ro: "Tichet deschis", ru: "Заявка создана" },
  clientUpdate: { en: "Client update", ro: "Raport pentru client", ru: "Отчёт клиенту" },
  openJob: { en: "Open in workspace", ro: "Deschide în spațiul de lucru", ru: "Открыть в рабочем пространстве" },
  fleet: { en: "Fleet", ro: "Parc", ru: "Парк" },
  f_all: { en: "All", ro: "Toate", ru: "Все" },
  f_attention: { en: "Needs attention", ro: "Necesită atenție", ru: "Требуют внимания" },
  f_ontrack: { en: "On track", ro: "În grafic", ru: "В норме" },
  f_pending: { en: "First month pending", ro: "Prima lună în curs", ru: "Первый месяц" },
  c_system: { en: "System", ro: "Sistem", ru: "Система" },
  c_last: { en: "Last month", ro: "Ultima lună", ru: "Посл. месяц" },
  c_ytd: { en: "This year", ro: "Anul acesta", ru: "За год" },
  c_trend: { en: "Month by month", ro: "Lună de lună", ru: "По месяцам" },
  c_saved: { en: "Client saved", ro: "Economie client", ru: "Экономия клиента" },
  c_status: { en: "Status", ro: "Stare", ru: "Статус" },
  sample: { en: "sample", ro: "exemplu", ru: "пример" },
  since: { en: "Live since", ro: "Funcționează din", ru: "Работает с" },
  chartTitle: { en: "Production vs P50", ro: "Producție vs P50", ru: "Выработка vs P50" },
  legendP50: { en: "P50 promised", ro: "P50 promis", ru: "P50 обещано" },
  legendAct: { en: "actual", ro: "real", ru: "факт" },
  noSel: { en: "Select a system in the table to see its detail and write its client update.", ro: "Alege un sistem din tabel pentru detalii și pentru raportul către client.", ru: "Выберите систему в таблице, чтобы увидеть детали и отчёт клиенту." },
  msgLang: { en: "Message language", ro: "Limba mesajului", ru: "Язык сообщения" },
  copy: { en: "Copy", ro: "Copiază", ru: "Копировать" },
  copied: { en: "Message copied", ro: "Mesaj copiat", ru: "Сообщение скопировано" },
  whyPhone: {
    en: "Sent from your own phone, so it lands as a message from the people who installed the system, not a no-reply email.",
    ro: "Pleacă de pe telefonul tău, deci ajunge ca mesaj de la cei care au montat sistemul, nu ca un e-mail automat.",
    ru: "Уходит с вашего телефона, поэтому приходит как сообщение от тех, кто монтировал систему, а не как автоматическое письмо.",
  },
  emptyTitle: { en: "No systems handed over yet", ro: "Niciun sistem predat încă", ru: "Пока нет сданных систем" },
  emptyBody: {
    en: "A job joins the fleet once its handover certificate is signed in the Installation step of its workspace. The readings you enter in its Monitoring step then show up here, measured against the quote's P50.",
    ro: "O lucrare intră în parc după ce certificatul de predare e semnat în pasul Montaj din spațiul ei de lucru. Citirile introduse în pasul Monitorizare apar apoi aici, măsurate față de P50-ul din ofertă.",
    ru: "Объект попадает в парк, когда акт передачи подписан на шаге «Монтаж» его рабочего пространства. Показания, внесённые на шаге «Мониторинг», появятся здесь в сравнении с P50 из расчёта.",
  },
  loadSample: { en: "Load a sample fleet (8 systems in Moldova)", ro: "Încarcă un parc exemplu (8 sisteme în Moldova)", ru: "Загрузить пример (8 систем в Молдове)" },
  removeSample: { en: "Remove sample fleet", ro: "Șterge parcul exemplu", ru: "Удалить пример" },
  goJobs: { en: "Go to jobs", ro: "Mergi la lucrări", ru: "К объектам" },
  t_loaded: { en: "Sample fleet loaded", ro: "Parc exemplu încărcat", ru: "Пример загружен" },
  t_removed: { en: "Sample fleet removed", ro: "Parc exemplu șters", ru: "Пример удалён" },
};

const STATUS = {
  critical: { chip: "red", label: { en: "Critical", ro: "Critic", ru: "Критично" } },
  nodata: { chip: "amber", label: { en: "No reading", ro: "Fără citire", ru: "Нет данных" } },
  warn: { chip: "amber", label: { en: "Below P50", ro: "Sub P50", ru: "Ниже P50" } },
  watch: { chip: "blue", label: { en: "Watch", ro: "De urmărit", ru: "Наблюдать" } },
  ok: { chip: "green", label: { en: "Healthy", ro: "În parametri", ru: "В норме" } },
  pending: { chip: "grey", label: { en: "First month pending", ro: "Prima lună în curs", ru: "Первый месяц" } },
};
const NEEDS_ATTENTION = new Set(["critical", "warn", "nodata"]);

const pct = (r) => (r == null ? "—" : Math.round(r * 100) + "%");
const tone = (r) => (r == null ? "" : r >= THRESH.healthy ? "good" : r >= THRESH.watch ? "mid" : "bad");
const toneCls = (r) => (r == null ? "" : "mn-t-" + tone(r));

// The locality a person would name: skip postal codes and district/county
// prefixes ("r. Anenii Noi", "jud. Ilfov") so "s. Mereni, r. Anenii Noi"
// reads as the village, and "…, Chișinău, MD-2019" as the city.
function place(job) {
  const parts = String(job.address || "").split(",").map((s) => s.trim()).filter(Boolean);
  const named = parts.slice(1).filter((p) => !/^(MD-|\d)/.test(p) && !/^(r\.|jud\.|raionul|judet)/i.test(p));
  return named.length ? named[named.length - 1] : (parts[0] || "");
}
const fill = (s, vars) => Object.keys(vars).reduce((a, k) => a.split("{" + k + "}").join(vars[k]), s);

function monthSpan(list, names) {
  if (!list.length) return "";
  const a = names[list[0]], b = names[list[list.length - 1]];
  return list.length === 1 ? a : `${a}–${b}`;
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Headline, evidence and next step for a diagnosed cause, worded per language.
// Single months are spelled out (a sentence can open with one); ranges use
// the short names.
function explain(row, lang) {
  const out = explainRaw(row, lang);
  return out && { ...out, head: cap(out.head), detail: cap(out.detail) };
}

function explainRaw(row, lang) {
  const { a } = row;
  const m = MONTHS[lang] || MONTHS.en;
  const ml = MONTHS_LONG[lang] || MONTHS_LONG.en;
  const e = a.evidence || {};
  const L = (d) => tx(d, lang);
  switch (a.cause) {
    case "no_reading": {
      const span = monthSpan(Array.from({ length: e.missingTo - e.missingFrom + 1 }, (_, k) => e.missingFrom + k), e.missingFrom === e.missingTo ? ml : m);
      return {
        head: fill(L({ en: "No reading for {m}", ro: "Lipsește citirea pentru {m}", ru: "Нет показаний за {m}" }), { m: span }),
        detail: a.last
          ? fill(L({ en: "The last reading on file is for {m}.", ro: "Ultima citire înregistrată este pentru {m}.", ru: "Последние показания: {m}." }), { m: ml[a.last.i] })
          : L({ en: "No readings since handover.", ro: "Nicio citire de la predare.", ru: "Нет показаний с момента сдачи." }),
        action: L({
          en: "Ask the client for a screenshot of the inverter app, or check the datalogger's Wi-Fi. A new router is the usual culprit.",
          ro: "Cere-i clientului o captură din aplicația invertorului sau verifică Wi-Fi-ul dataloggerului. De obicei e de vină un router nou.",
          ru: "Попросите у клиента скриншот из приложения инвертора или проверьте Wi-Fi логгера. Чаще всего виноват новый роутер.",
        }),
      };
    }
    case "overvoltage":
      return {
        head: L({ en: "Likely tripping on grid overvoltage", ro: "Probabil se deconectează la supratensiune în rețea", ru: "Вероятно, отключается из-за перенапряжения в сети" }),
        detail: fill(L({
          en: "{months} ran at {min}–{max}% of P50, while {spring} held {sp}%. The loss follows the midday sun, which is typical of a weak rural line.",
          ro: "{months}: între {min}% și {max}% din P50, deși {spring} a ținut {sp}%. Pierderea urmează soarele de la prânz, tipic pentru o linie rurală slabă.",
          ru: "{months}: {min}–{max}% от P50, хотя {spring} держались на {sp}%. Потери следуют за полуденным солнцем, что типично для слабой сельской линии.",
        }), {
          months: monthSpan(e.months, m), min: Math.round(e.min * 100), max: Math.round(e.max * 100),
          spring: monthSpan([2, 3], m), sp: Math.round(e.springAvg * 100),
        }),
        action: L({
          en: "Pull the inverter's event log for \"grid overvoltage\" trips around midday. If confirmed, ask the distribution operator (Premier Energy Distribution in the centre and south, RED Nord in the north) to measure voltage at the connection point.",
          ro: "Verifică jurnalul invertorului pentru declanșări „supratensiune rețea” în jurul prânzului. Dacă se confirmă, cere operatorului de distribuție (Premier Energy Distribution în centru și sud, RED Nord în nord) o măsurare a tensiunii la punctul de racordare.",
          ru: "Проверьте журнал инвертора на отключения «перенапряжение сети» около полудня. Если подтвердится, попросите оператора сети (Premier Energy Distribution в центре и на юге, RED Nord на севере) замерить напряжение в точке подключения.",
        }),
      };
    case "soiling":
      return {
        head: L({ en: "Output sliding month over month, likely soiling", ro: "Producția scade lună de lună, probabil murdărie", ru: "Выработка падает каждый месяц, вероятно, загрязнение" }),
        detail: fill(L({
          en: "{a} {ra}% → {b} {rb}% of P50, lower every month.",
          ro: "{a} {ra}% → {b} {rb}% din P50, mai puțin în fiecare lună.",
          ru: "{a} {ra}% → {b} {rb}% от P50, ниже с каждым месяцем.",
        }), { a: m[e.from], ra: Math.round(e.fromRatio * 100), b: m[e.to], rb: Math.round(e.toRatio * 100) }),
        action: L({
          en: "Book a cleaning visit. Dust from fields and roads builds up fast over a dry summer. Re-check the month after.",
          ro: "Programează o vizită de curățare. Praful de pe câmpuri și drumuri se adună repede într-o vară secetoasă. Reverifică luna următoare.",
          ru: "Запланируйте мойку панелей. Пыль с полей и дорог быстро копится за сухое лето. Проверьте снова через месяц.",
        }),
      };
    case "sudden_drop":
      return {
        head: L({ en: "Sudden drop, possible fault", ro: "Scădere bruscă, posibilă defecțiune", ru: "Резкое падение, возможна неисправность" }),
        detail: fill(L({
          en: "{m} fell to {r}% of P50 after {pm} at {pr}%.",
          ro: "{m} a scăzut la {r}% din P50, după {pm} cu {pr}%.",
          ru: "{pm}: {pr}% → {m}: {r}% от P50.",
        }), { m: ml[e.month], r: Math.round(e.ratio * 100), pm: ml[e.prevMonth], pr: Math.round(e.prevRatio * 100) }),
        action: L({
          en: "Check the inverter for error codes and compare string currents. One string or MPPT offline is the usual cause.",
          ro: "Verifică codurile de eroare ale invertorului și compară curenții pe șiruri. De obicei e un șir sau un MPPT deconectat.",
          ru: "Проверьте коды ошибок инвертора и сравните токи цепочек. Обычно отключена одна цепочка или MPPT.",
        }),
      };
    case "snow":
      return {
        head: L({ en: "Low winter output, likely snow cover", ro: "Producție mică iarna, probabil zăpadă", ru: "Низкая зимняя выработка, вероятно, снег" }),
        detail: fill(L({ en: "{m} at {r}% of P50.", ro: "{m}: {r}% din P50.", ru: "{m}: {r}% от P50." }), { m: ml[e.month], r: Math.round(e.ratio * 100) }),
        action: L({
          en: "No visit needed unless it persists after the thaw.",
          ro: "Nu e nevoie de vizită decât dacă persistă după dezgheț.",
          ru: "Выезд не нужен, если после оттепели всё восстановится.",
        }),
      };
    case "low":
      return {
        head: L({ en: "Below the promise", ro: "Sub cât s-a promis", ru: "Ниже обещанного" }),
        detail: fill(L({
          en: "{m} at {r}% of P50, {y}% for the year so far.",
          ro: "{m}: {r}% din P50, {y}% de la începutul anului.",
          ru: "{m}: {r}% от P50, {y}% с начала года.",
        }), { m: ml[e.month], r: Math.round(e.ratio * 100), y: Math.round((a.ratioYtd || 0) * 100) }),
        action: L({
          en: "Look for new shading, soiling or an inverter fault on the next visit.",
          ro: "Caută umbrire nouă, murdărie sau o defecțiune a invertorului la următoarea vizită.",
          ru: "При следующем визите проверьте новое затенение, загрязнение или неисправность инвертора.",
        }),
      };
    default:
      return null;
  }
}

/* ------------------------------------------------------ client message ---- */
function ruLei(n) {
  const f = new Intl.PluralRules("ru").select(n);
  return f === "one" ? "лей" : f === "few" ? "лея" : "леев";
}

function clientMessage(row, msgLang) {
  const { job, a, asOf } = row;
  const loc = msgLang === "ru" ? "ru-RU" : msgLang === "en" ? "en-IE" : "ro-RO";
  const n = (v) => Math.round(v).toLocaleString(loc);
  const month = (MONTHS_LONG[msgLang] || MONTHS_LONG.ro)[asOf];
  const kw = (+job.kw || 0).toLocaleString(loc, { maximumFractionDigits: 1 });
  const kwh = row.monthActual(asOf);
  const ytdLei = Math.round(localLei(row.savedYtdEur, job.market));

  if (a.status === "pending") {
    return {
      ro: `Bună ziua! Sistemul dvs. solar de ${kw} kW funcționează. Primul raport lunar vi-l trimitem după prima lună întreagă de producție.`,
      ru: `Здравствуйте! Ваша солнечная станция ${kw} кВт работает. Первый ежемесячный отчёт пришлём после первого полного месяца выработки.`,
      en: `Hi! Your ${kw} kW solar system is up and running. We'll send your first monthly report after its first full month of production.`,
    }[msgLang];
  }
  if (kwh == null) {
    return {
      ro: `Bună ziua! Nu am primit datele de producție pentru ${month} de la sistemul dvs. solar de ${kw} kW. Ne puteți trimite o captură de ecran din aplicația invertorului? Durează un minut și ne ajută să verificăm că totul funcționează corect.`,
      ru: `Здравствуйте! Мы не получили данные о выработке вашей солнечной станции ${kw} кВт за ${month}. Пришлите, пожалуйста, скриншот из приложения инвертора: это займёт минуту и поможет нам убедиться, что всё работает правильно.`,
      en: `Hi! We haven't received the production figures for ${month} from your ${kw} kW solar system. Could you send us a screenshot from the inverter app? It takes a minute and lets us check everything is working properly.`,
    }[msgLang];
  }

  const ratio = kwh / (row.p50[asOf] || 1);
  const pc = Math.round(ratio * 100);
  const monthLei = Math.round(localLei(kwh * row.eurPerKwh, job.market));
  const low = a.status === "warn" || a.status === "critical";

  if (msgLang === "ru") {
    const head = `Здравствуйте! Ежемесячный отчёт по вашей солнечной станции ${kw} кВт.\n\nЗа ${month} она выработала ${n(kwh)} кВт·ч, это ${pc}% от расчёта в нашем предложении.`;
    return low
      ? `${head} Это меньше, чем должно быть, поэтому в ближайшие дни мы свяжемся с вами, чтобы проверить систему.\n\nПримерная экономия с начала года: ~${n(ytdLei)} ${ruLei(ytdLei)}.`
      : `${head}\nПримерная экономия: ~${n(monthLei)} ${ruLei(monthLei)} за ${month} и ~${n(ytdLei)} ${ruLei(ytdLei)} с начала года.\n\nСистема работает нормально. Если есть вопросы, пишите в любое время.`;
  }
  if (msgLang === "en") {
    const M = month;
    const head = `Hi! Here's the monthly report for your ${kw} kW solar system.\n\nIn ${M} it produced ${n(kwh)} kWh, ${pc}% of what we estimated in your quote.`;
    return low
      ? `${head} That's less than it should be, so we'll be in touch in the next few days to check the system.\n\nEstimated savings so far this year: ~${n(ytdLei)} lei.`
      : `${head}\nEstimated savings: ~${n(monthLei)} lei in ${M} and ~${n(ytdLei)} lei so far this year.\n\nEverything is working normally. Any questions, just message us.`;
  }
  const head = `Bună ziua! Raportul lunar al sistemului dvs. solar de ${kw} kW.\n\nÎn ${month} a produs ${n(kwh)} kWh, adică ${pc}% din cât am estimat în ofertă.`;
  return low
    ? `${head} Este mai puțin decât ar trebui, așa că vă contactăm în zilele următoare pentru o verificare.\n\nEconomie estimată de la începutul anului: ~${n(ytdLei)} lei.`
    : `${head}\nEconomie estimată: ~${n(monthLei)} lei în ${month} și ~${n(ytdLei)} lei de la începutul anului.\n\nSistemul funcționează normal. Dacă aveți întrebări, scrieți-ne oricând.`;
}

/* ----------------------------------------------------------------- viz ---- */
// Twelve thin bars, one per month, height = share of that month's P50; the
// hairline is 100%. Empty slots before go-live stay blank; a missing reading
// inside the live window shows as a short grey stub so a gap is visible.
function Trend({ ratios, asOf, start }) {
  const W = 12 * 9 - 2, H = 26, top = 1.2;
  const y100 = H - (1 / top) * H;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="mn-trend">
      <line x1="0" x2={W} y1={y100} y2={y100} className="mn-trend-base" />
      {ratios.map((r, i) => {
        if (i > asOf || i < start) return null;
        if (r == null) return <rect key={i} x={i * 9} y={H - 3} width="7" height="3" rx="1" className="mn-bar-none" />;
        const h = Math.max(2, (Math.min(r, top) / top) * H);
        return <rect key={i} x={i * 9} y={H - h} width="7" height={h} rx="1.5" className={"mn-bar-" + tone(r)} />;
      })}
    </svg>
  );
}

function MonthChart({ row, lang }) {
  const m = MONTHS[lang] || MONTHS.en;
  const max = Math.max(1, ...row.p50, ...row.actual.map((v) => Number(v) || 0));
  return (
    <div className="mn-chart" role="img" aria-label={tx(T.chartTitle, lang)}>
      {row.p50.map((p, i) => {
        const act = row.monthActual(i);
        const r = row.a.ratios[i];
        return (
          <div key={i} className="mn-col" title={`${m[i]} · P50 ${NUM(p)} kWh${act != null ? ` · ${NUM(act)} kWh (${pct(act / p)})` : ""}`}>
            <div className="mn-col-bars">
              <span className="mn-col-p50" style={{ height: (p / max) * 100 + "%" }} />
              {act != null && i <= row.asOf && <span className={"mn-col-act " + (r != null ? tone(r) : "")} style={{ height: (act / max) * 100 + "%" }} />}
            </div>
            <span className="mn-col-m">{m[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- page ---- */
export default function MonitoringPage() {
  return (
    <Suspense fallback={null}>
      <FleetMonitoring />
    </Suspense>
  );
}

function FleetMonitoring() {
  const lang = useLang();
  const t = (o) => tx(o, lang);
  const params = useSearchParams();
  const { jobs, addJobs, removeJobs, hydrated } = useStudioJobs();
  const [toast, fire] = useToast();
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState(null);
  const [msgLang, setMsgLang] = useState(null);
  const [ticketRev, setTicketRev] = useState(0);
  const detailRef = useRef(null);
  const now = useMemo(() => new Date(), []);
  const m = MONTHS[lang] || MONTHS.en;

  useEffect(() => { document.title = tx(T.title, lang) + " — VoltMira Studio"; }, [lang]);

  // Readings live in their own localStorage keys, so the job list is the only
  // React state they hang off: loading/removing the sample fleet changes
  // `jobs`, and a reading edited in the workspace remounts this page.
  const rows = useMemo(() => (hydrated ? fleetRows(jobs, now) : []), [jobs, hydrated, now]);
  const asOf = rows[0]?.asOf ?? ((now.getMonth() + 11) % 12);

  const stats = useMemo(() => {
    const kwp = rows.reduce((s, r) => s + (+r.job.kw || 0), 0);
    const mwh = rows.reduce((s, r) => s + r.a.ytdActual, 0) / 1000;
    const saved = rows.reduce((s, r) => s + r.savedYtdEur, 0);
    const lost = rows.reduce((s, r) => s + r.lostEur, 0);
    const attention = rows.filter((r) => NEEDS_ATTENTION.has(r.a.status)).length;
    return { kwp, mwh, saved, lost, attention, ratio: fleetRatio(rows.map((r) => r.a)) };
  }, [rows]);

  const queue = useMemo(() => rows.filter((r) => NEEDS_ATTENTION.has(r.a.status)).sort((x, y) => compareUrgency(x.a, y.a)), [rows]);
  const sorted = useMemo(() => rows.slice().sort((x, y) => compareUrgency(x.a, y.a)), [rows]);
  const counts = useMemo(() => ({
    all: rows.length,
    attention: stats.attention,
    ontrack: rows.filter((r) => r.a.status === "ok" || r.a.status === "watch").length,
    pending: rows.filter((r) => r.a.status === "pending").length,
  }), [rows, stats.attention]);
  const visible = sorted.filter((r) =>
    filter === "all" ? true
      : filter === "attention" ? NEEDS_ATTENTION.has(r.a.status)
      : filter === "ontrack" ? r.a.status === "ok" || r.a.status === "watch"
      : r.a.status === "pending");

  // Default selection: the ?job= deep link from a job's hub, else the most
  // urgent system, else the first one.
  useEffect(() => {
    if (!rows.length) { setSelId(null); return; }
    if (selId && rows.some((r) => r.job.id === selId)) return;
    const wanted = params.get("job");
    setSelId((wanted && rows.some((r) => r.job.id === wanted) ? wanted : (queue[0] || sorted[0]).job.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const sel = rows.find((r) => r.job.id === selId) || null;
  const selLang = msgLang || sel?.job.clientLang || (lang === "ru" ? "ru" : "ro");

  const hasSample = jobs.some(isSample);

  function loadSample() {
    const added = buildSampleFleet(new Set(jobs.map((j) => j.id)), now);
    if (added.length) addJobs(added);
    fire(t(T.t_loaded));
  }
  function removeSample() {
    const ids = jobs.filter(isSample).map((j) => j.id);
    ids.forEach(clearJobStorage);
    removeJobs(ids);
    setSelId(null);
    fire(t(T.t_removed));
  }

  // One ticket per system, per diagnosed cause, per month: logging it again
  // would only duplicate the job on the crew's list.
  const ticketTag = (row) => `${row.a.cause}:${row.asOf}`;
  const loggedTags = useMemo(() => new Set(rows.flatMap((r) =>
    loadTickets(r.job.id).filter((tk) => tk.open && tk.tag).map((tk) => r.job.id + "|" + tk.tag))), [rows, ticketRev]);
  const hasTicket = (row) => loggedTags.has(row.job.id + "|" + ticketTag(row));
  function logTicket(row, ex) {
    addTicket(row.job.id, `${ex.head} (${m[row.asOf]})`, ticketTag(row));
    setTicketRev((v) => v + 1);
    fire(t(T.ticketLogged));
  }
  function focus(row) {
    setSelId(row.job.id);
    setMsgLang(null);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const message = sel ? clientMessage(sel, selLang) : "";
  function copyMessage() {
    try { navigator.clipboard?.writeText(message); } catch { /* clipboard blocked */ }
    fire(t(T.copied));
  }

  if (!hydrated) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {toast}
      <PreviewHeader slug="monitoring" lang={lang} title={t(T.title)} sub={t(T.sub)}
        right={hasSample ? <button className="btn ghost sm" onClick={removeSample}>{t(T.removeSample)}</button> : null} />
      <MockNote>{t(T.note)}</MockNote>

      {rows.length === 0 ? (
        <div className="pv-panel mn-empty">
          <div className="mn-empty-ic" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
          </div>
          <h2>{t(T.emptyTitle)}</h2>
          <p>{t(T.emptyBody)}</p>
          <div className="mn-empty-cta">
            <button className="btn primary sm" onClick={loadSample}>{t(T.loadSample)}</button>
            <Link href={PREVIEW_BASE} className="btn ghost sm">{t(T.goJobs)}</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="pv-metrics mn-kpis">
            <div className="pv-metric"><b>{rows.length}</b><span>{t(T.k_systems)} · {NUM(stats.kwp, stats.kwp < 100 ? 1 : 0)} kWp</span></div>
            <div className={"pv-metric" + (stats.ratio == null ? "" : stats.ratio >= THRESH.healthy ? " good" : stats.ratio < 0.9 ? " warn" : "")}>
              <b>{pct(stats.ratio)}</b><span>{t(T.k_ratio)}</span>
            </div>
            <div className="pv-metric"><b>{NUM(stats.mwh, 1)} MWh</b><span>{t(T.k_energy)}</span></div>
            <div className="pv-metric good"><b>{EUR(stats.saved)}</b><span>{t(T.k_saved)}</span></div>
            <div className={"pv-metric" + (stats.attention ? " warn" : " good")}><b>{stats.attention}</b><span>{t(T.k_attention)}</span></div>
            <div className={"pv-metric" + (stats.lost > 0 ? " warn" : "")}><b>{EUR(stats.lost)}</b><span>{t(T.k_lost)}</span></div>
          </div>

          <section className="mn-section">
            <h2 className="mn-h2">{t(T.queue)} <span>{queue.length}</span></h2>
            {queue.length === 0 ? (
              <div className="pv-panel mn-allclear">{fill(t(T.queueNone), { m: (MONTHS_LONG[lang] || MONTHS_LONG.en)[asOf] })}</div>
            ) : (
              <div className="mn-queue">
                {queue.map((row) => {
                  const ex = explain(row, lang);
                  const st = STATUS[row.a.status];
                  const logged = hasTicket(row);
                  return (
                    <article key={row.job.id} className="mn-card">
                      <header className="mn-card-top">
                        <span className={"pv-stage " + st.chip}>{tx(st.label, lang)}</span>
                        <span className="mn-card-who"><b>{row.job.name}</b> · {place(row.job)} · {NUM(+row.job.kw, 1)} kW</span>
                        {row.lostEur > 0 && <span className="mn-card-lost">−{EUR(row.lostEur)}</span>}
                      </header>
                      <h3 className="mn-card-head">{ex.head}</h3>
                      <p className="mn-card-detail">{ex.detail}</p>
                      <div className="mn-card-do"><span>{t(T.whatToDo)}</span>{ex.action}</div>
                      <div className="mn-card-btns">
                        <button className="btn primary sm" disabled={logged} onClick={() => logTicket(row, ex)}>
                          {logged ? t(T.ticketLogged) + " ✓" : t(T.logTicket)}
                        </button>
                        <button className="btn ghost sm" onClick={() => focus(row)}>{t(T.clientUpdate)}</button>
                        <Link className="btn ghost sm" href={`${PREVIEW_BASE}/jobs/${row.job.id}/configure?step=5`}>{t(T.openJob)}</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mn-section">
            <div className="mn-fleet-head">
              <h2 className="mn-h2">{t(T.fleet)} <span>{rows.length}</span></h2>
              <div className="pv-fchips">
                {[["all", T.f_all], ["attention", T.f_attention], ["ontrack", T.f_ontrack], ...(counts.pending ? [["pending", T.f_pending]] : [])].map(([k, lbl]) => (
                  <button key={k} className={"pv-fchip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
                    {t(lbl)} · {counts[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className="pv-panel mn-tbl-panel">
              <div className="pv-tbl-wrap">
                <table className="pv-tbl mn-tbl">
                  <thead>
                    <tr>
                      <th>{t(T.c_system)}</th>
                      <th className="th-r">kWp</th>
                      <th className="th-r">{t(T.c_last)} · {m[asOf]}</th>
                      <th className="th-r">{t(T.c_ytd)}</th>
                      <th>{t(T.c_trend)}</th>
                      <th className="th-r">{t(T.c_saved)}</th>
                      <th>{t(T.c_status)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const st = STATUS[row.a.status];
                      const lastR = row.a.last?.i === asOf ? row.a.last.ratio : null;
                      // Draw from the first month that has — or should have — a reading.
                      const firstRead = row.a.ratios.findIndex((r) => r != null);
                      const start = Math.min(firstRead >= 0 ? firstRead : 12, row.a.evidence?.missingFrom ?? 12);
                      return (
                        <tr key={row.job.id} className={row.job.id === selId ? "sel" : ""} onClick={() => focus(row)}
                          tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), focus(row))}
                          aria-selected={row.job.id === selId}>
                          <td>
                            <div className="mn-sys">
                              <b>{row.job.name}{isSample(row.job) && <em>{t(T.sample)}</em>}</b>
                              <span>{place(row.job)} · {row.job.market}</span>
                            </div>
                          </td>
                          <td className="num">{NUM(+row.job.kw, 1)}</td>
                          <td className={"num mn-r " + toneCls(lastR)}>{pct(lastR)}</td>
                          <td className={"num mn-r " + toneCls(row.a.ratioYtd)}>{pct(row.a.ratioYtd)}</td>
                          <td><Trend ratios={row.a.ratios} asOf={asOf} start={start} /></td>
                          <td className="num">{NUM(localLei(row.savedYtdEur, row.job.market))} lei</td>
                          <td><span className={"pv-stage " + st.chip}>{tx(st.label, lang)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="mn-section" ref={detailRef}>
            {!sel ? (
              <div className="pv-panel mn-allclear">{t(T.noSel)}</div>
            ) : (
              <div className="pv-2col mn-detail">
                <div className="pv-panel">
                  <div className="mn-det-head">
                    <div>
                      <h2 className="mn-det-name">{sel.job.name}</h2>
                      <p className="mn-det-sub">
                        {[sel.job.address, `${NUM(+sel.job.kw, 1)} kWp`, +sel.job.batteryKwh > 0 ? `${sel.job.batteryKwh} kWh` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className={"pv-stage " + STATUS[sel.a.status].chip}>{tx(STATUS[sel.a.status].label, lang)}</span>
                  </div>
                  <div className="mn-det-kv">
                    <div><span>{t(T.c_ytd)}</span><b className={toneCls(sel.a.ratioYtd)}>{pct(sel.a.ratioYtd)}</b></div>
                    <div><span>{t(T.k_energy)}</span><b>{NUM(sel.a.ytdActual)} kWh</b></div>
                    <div><span>{t(T.c_saved)}</span><b>{NUM(localLei(sel.savedYtdEur, sel.job.market))} lei</b></div>
                    <div><span>{t(T.since)}</span><b>{sel.job.commissionedAt ? new Date(sel.job.commissionedAt).toLocaleDateString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-IE" : "ro-RO") : "—"}</b></div>
                  </div>
                  <h3 className="mn-sub-h">{t(T.chartTitle)}</h3>
                  <MonthChart row={sel} lang={lang} />
                  <div className="mn-legend">
                    <span><i className="p50" />{t(T.legendP50)}</span>
                    <span><i className="act" />{t(T.legendAct)}</span>
                  </div>
                  {(() => {
                    const ex = explain(sel, lang);
                    return ex && (
                      <div className="mn-det-diag">
                        <b>{ex.head}</b>
                        <p>{ex.detail}</p>
                        <p className="mn-det-do"><span>{t(T.whatToDo)}:</span> {ex.action}</p>
                      </div>
                    );
                  })()}
                  <div className="mn-card-btns" style={{ marginTop: 14 }}>
                    <Link className="btn ghost sm" href={`${PREVIEW_BASE}/jobs/${sel.job.id}/configure?step=5`}>{t(T.openJob)}</Link>
                  </div>
                </div>

                <div className="pv-panel">
                  <div className="mn-det-head">
                    <h3 style={{ margin: 0 }}>{t(T.clientUpdate)} · {(MONTHS_LONG[lang] || MONTHS_LONG.en)[asOf]}</h3>
                  </div>
                  <div className="mn-msg-lang">
                    <span>{t(T.msgLang)}</span>
                    <div className="pv-seg">
                      {[["ro", "RO"], ["ru", "RU"], ["en", "EN"]].map(([k, l]) => (
                        <button key={k} className={selLang === k ? "on" : ""} onClick={() => setMsgLang(k)}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mn-phone">
                    <div className="mn-phone-bar">
                      <span className="mn-avatar">{sel.job.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</span>
                      <b>{sel.job.name}</b>
                    </div>
                    <div className="mn-bubble" lang={selLang}>{message}</div>
                  </div>
                  <div className="mn-card-btns" style={{ marginTop: 14 }}>
                    <button className="btn primary sm" onClick={copyMessage}>{t(T.copy)}</button>
                    <a className="btn ghost sm" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    <a className="btn ghost sm" href={`viber://forward?text=${encodeURIComponent(message)}`}>Viber</a>
                  </div>
                  <p className="mn-why">{t(T.whyPhone)}</p>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

const CSS = `
.pv-stage.red{background:var(--red-tint);color:var(--red)}
.pv-stage.grey{background:var(--paper);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line)}
.mn-kpis{margin-bottom:26px}
.mn-kpis .pv-metric b{font-variant-numeric:tabular-nums}
.mn-section{margin-bottom:28px;scroll-margin-top:16px}
.mn-h2{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;letter-spacing:-.01em;margin:0 0 12px;color:var(--ink)}
.mn-h2 span{font-family:var(--font-m,monospace);font-size:11px;font-weight:700;color:var(--muted);background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:1px 7px}
.mn-allclear{font-size:13.5px;color:var(--muted)}

.mn-queue{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
.mn-card{background:var(--paper-2);border:1px solid var(--line);border-radius:14px;padding:16px 17px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px}
.mn-card-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mn-card-who{flex:1;min-width:0;font-size:12.5px;color:var(--muted)}
.mn-card-who b{color:var(--ink)}
.mn-card-lost{font-family:var(--font-m,monospace);font-size:12px;font-weight:700;color:var(--red)}
.mn-card-head{font-size:15px;font-weight:700;letter-spacing:-.01em;margin:4px 0 0;color:var(--ink);text-wrap:balance}
.mn-card-detail{margin:0;font-size:13px;color:var(--ink-soft);line-height:1.55;font-variant-numeric:tabular-nums}
.mn-card-do{font-size:12.5px;line-height:1.55;color:var(--ink-soft);background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.mn-card-do span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}
.mn-card-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}

.mn-fleet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.mn-fleet-head .mn-h2{margin:0}
.mn-tbl-panel{padding:6px 8px}
.mn-tbl tbody tr{cursor:pointer}
.mn-tbl tbody tr:focus-visible{outline:2px solid var(--amber);outline-offset:-2px}
.mn-tbl tbody tr.sel{background:var(--green-tint)}
.mn-sys{display:flex;flex-direction:column;gap:2px;min-width:170px}
.mn-sys b{font-size:13.5px;color:var(--ink);display:flex;align-items:center;gap:7px}
.mn-sys b em{font-style:normal;font-family:var(--font-m,monospace);font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:1px 5px}
.mn-sys span{font-size:11.5px;color:var(--muted)}
.mn-r{font-weight:700}
.mn-t-good{color:var(--green)}
.mn-t-mid{color:#B4700F}
.mn-t-bad{color:var(--red)}
.mn-trend{display:block}
.mn-trend-base{stroke:var(--hair);stroke-width:1;stroke-dasharray:2 2}
.mn-bar-good{fill:var(--green)}
.mn-bar-mid{fill:var(--amber)}
.mn-bar-bad{fill:var(--red)}
.mn-bar-none{fill:var(--hair)}

.mn-detail{align-items:stretch}
.mn-det-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.mn-det-name{font-size:17px;font-weight:700;letter-spacing:-.015em;margin:0;color:var(--ink)}
.mn-det-sub{margin:4px 0 0;font-size:12.5px;color:var(--muted);line-height:1.5}
.mn-det-kv{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px}
.mn-det-kv div{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:9px 11px}
.mn-det-kv span{display:block;font-size:11px;color:var(--muted)}
.mn-det-kv b{font-size:15px;font-variant-numeric:tabular-nums}
.mn-sub-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin:0 0 10px}
.mn-chart{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;height:150px;align-items:end}
.mn-col{display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;min-width:0}
.mn-col-bars{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:2px}
.mn-col-bars span{width:42%;border-radius:3px 3px 0 0;min-height:1px}
.mn-col-p50{background:var(--hair)}
.mn-col-act{background:var(--green)}
.mn-col-act.mid{background:var(--amber)}
.mn-col-act.bad{background:var(--red)}
.mn-col-m{font-family:var(--font-m,monospace);font-size:9.5px;color:var(--muted)}
.mn-legend{display:flex;gap:16px;margin-top:10px;font-size:11.5px;color:var(--muted)}
.mn-legend span{display:inline-flex;align-items:center;gap:6px}
.mn-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.mn-legend i.p50{background:var(--hair)}
.mn-legend i.act{background:var(--green)}
.mn-det-diag{margin-top:16px;border-top:1px solid var(--line);padding-top:14px;font-size:13px;line-height:1.55;color:var(--ink-soft)}
.mn-det-diag b{display:block;color:var(--ink);font-size:14px;margin-bottom:4px}
.mn-det-diag p{margin:0 0 6px}
.mn-det-do span{font-weight:700;color:var(--ink)}

.mn-msg-lang{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;font-size:12px;font-weight:600;color:var(--muted)}
.mn-phone{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:12px 12px 16px}
.mn-phone-bar{display:flex;align-items:center;gap:9px;padding:2px 2px 12px;border-bottom:1px solid var(--line);margin-bottom:12px;font-size:13px;color:var(--ink)}
.mn-avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--green-tint);color:var(--green);font-size:11px;font-weight:700}
.mn-bubble{margin-left:auto;max-width:92%;background:var(--green-tint);color:var(--ink);border-radius:14px 14px 4px 14px;padding:11px 13px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.mn-why{margin:12px 0 0;font-size:11.5px;color:var(--muted);line-height:1.5}

.mn-empty{text-align:center;padding:44px 24px}
.mn-empty-ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;margin:0 auto 14px;background:var(--green-tint);color:var(--green)}
.mn-empty h2{font-size:17px;margin:0 0 8px;color:var(--ink)}
.mn-empty p{max-width:58ch;margin:0 auto 18px;font-size:13.5px;color:var(--muted);line-height:1.6}
.mn-empty-cta{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}

@media(max-width:520px){
  .mn-queue{grid-template-columns:minmax(0,1fr)}
  .mn-card-btns .btn{flex:1 1 auto}
  .mn-chart{gap:2px;height:120px}
}
@media (prefers-reduced-motion:reduce){.mn-section{scroll-behavior:auto}}
`;
