"use client";
// Studio · Connection pipeline (Moldova) — a working tool, not just a mock.
//  • generates the real submission documents (cerere de racordare + memoriu
//    tehnic + Casa Verde borderou), filled from the client bar, print → PDF;
//  • the pipeline is a saved tracker: click a stage to advance it, it persists
//    per contract in localStorage;
//  • the FEERM eligibility gate + grant estimate run on the live engine.
// Still self-contained: nothing is submitted to an operator or written to Supabase.
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, printDoc,
  useStudioClient, ClientBar, engineSettings, DEMO_SYSTEM, PROTECTION,
} from "../studio-kit.jsx";
import { simulate, FX } from "../_engine.js";

const TX = {
  title: { en: "Connection pipeline", ro: "Flux de racordare", ru: "Процесс подключения" },
  sub: {
    en: "The Moldovan post-signature process as one place — generate the submission documents, track each stage, check the Casa Verde grant. Fill the client bar once; everything below fills itself.",
    ro: "Procesul de după semnare din Moldova într-un singur loc — generezi documentele de depus, urmărești fiecare etapă, verifici grantul Casa Verde. Completezi bara de client o dată; tot ce urmează se completează singur.",
    ru: "Процесс после подписания в Молдове в одном месте — сформируйте документы, отслеживайте этапы, проверьте грант Casa Verde. Заполните панель клиента один раз.",
  },
  note: {
    en: "The documents and the grant estimate are real (engine + your client data) and print to PDF. The pipeline is saved in this browser per contract number. Nothing is sent to an operator — you submit the PDF yourself, an authorised electrician signs it.",
    ro: "Documentele și estimarea grantului sunt reale (motor + datele clientului tău) și se printează în PDF. Fluxul se salvează în acest browser, pe număr de contract. Nimic nu se trimite la operator — depui tu PDF-ul, un electrician autorizat îl semnează.",
    ru: "Документы и оценка гранта реальны (движок + данные клиента) и печатаются в PDF. Процесс сохраняется в этом браузере по номеру договора. Ничего не отправляется оператору.",
  },
  gen: { en: "Print / Export PDF", ro: "Printează / Export PDF", ru: "Печать / PDF" },
  opTitle: { en: "Operator & area headroom", ro: "Operator și rezervă de zonă", ru: "Оператор и резерв зоны" },
  feermTitle: { en: "Casa Verde (FEERM) — eligibility gate", ro: "Casa Verde (FEERM) — verificare eligibilitate", ru: "Casa Verde (FEERM) — проверка права на грант" },
  flowTitle: { en: "Pipeline — click a stage to advance it", ro: "Flux — apasă o etapă ca s-o avansezi", ru: "Процесс — нажмите на этап, чтобы продвинуть" },
  inboxTitle: { en: "Waiting on your decision", ro: "Așteaptă decizia ta", ru: "Ждёт вашего решения" },
  reset: { en: "Reset tracker", ro: "Resetează urmărirea", ru: "Сбросить" },
  headroom: { en: "area headroom", ro: "rezervă în zonă", ru: "резерв зоны" },
  allocated: { en: "allocated", ro: "alocat", ru: "распределено" },
  cap: { en: "area cap", ro: "plafon zonă", ru: "лимит зоны" },
  insulation: { en: "Wall / roof insulation", ro: "Izolație pereți / acoperiș", ru: "Утепление стен / крыши" },
  windows: { en: "Windows replaced", ro: "Ferestre înlocuite", ru: "Окна заменены" },
  done: { en: "done", ro: "făcut", ru: "готово" },
  notDone: { en: "not yet", ro: "încă nu", ru: "ещё нет" },
  eligibleV: { en: "PV is eligible for the grant.", ro: "Panourile sunt eligibile pentru grant.", ru: "Панели имеют право на грант." },
  grantEst: { en: "Estimated grant", ro: "Grant estimat", ru: "Оценка гранта" },
  ofCapex: { en: "of system cost", ro: "din costul sistemului", ru: "от стоимости системы" },
  blockedIns: {
    en: "Not eligible yet — thermal insulation must be completed first (consumption-reduction measures have priority).",
    ro: "Încă neeligibil — izolația termică trebuie finalizată prima (măsurile de reducere a consumului au prioritate).",
    ru: "Пока не проходит — сначала утепление (меры по снижению потребления в приоритете).",
  },
  blockedWin: {
    en: "Not eligible yet — the windows must be replaced first (consumption-reduction measures have priority).",
    ro: "Încă neeligibil — ferestrele trebuie înlocuite prima (măsurile de reducere a consumului au prioritate).",
    ru: "Пока не проходит — сначала замена окон (меры по снижению потребления в приоритете).",
  },
  riskTitle: { en: "Rejection-risk check", ro: "Verificare risc de respingere", ru: "Проверка риска отказа" },
  fixed: { en: "mark ready", ro: "marchează gata", ru: "отметить" },
  reframe: {
    en: "This is what moves VoltMira from “quoting software” to “the system that gets your prosumers connected” — a category with no other entrant in Moldova.",
    ro: "Asta mută VoltMira din „software de ofertare” în „sistemul care îți racordează prosumatorii” — o categorie fără alt jucător în Moldova.",
    ru: "Именно это переводит VoltMira из «программы для расчётов» в «систему, которая подключает ваших просьюмеров».",
  },
  advance: { en: "advanced", ro: "avansat", ru: "продвинуто" },
};

const NORTH_HINTS = ["bălți", "balti", "edine", "soroca", "drochia", "fălești", "falesti", "rîșcani", "riscani", "glodeni", "ocni", "briceni", "donduș", "dondus", "sîngerei", "singerei", "florești", "floresti"];

function resolveOperator(address) {
  const a = String(address || "").toLowerCase();
  const north = NORTH_HINTS.some((h) => a.includes(h));
  return north
    ? { id: "rednord", name: "ÎCS RED Nord SA", areaRo: "nordul țării", areaEn: "north", areaRu: "север", capMw: 30, usedMw: 12.1 }
    : { id: "premier", name: "Premier Energy Distribution SA", areaRo: "centru + sud", areaEn: "centre + south", areaRu: "центр + юг", capMw: 100, usedMw: 46.3 };
}

const ST = {
  done: { en: "done", ro: "făcut", ru: "готово" },
  active: { en: "in progress", ro: "în lucru", ru: "в работе" },
  waiting: { en: "waiting on operator", ro: "așteaptă operatorul", ru: "ждём оператора" },
  todo: { en: "to do", ro: "de făcut", ru: "предстоит" },
};
const NEXT_STATUS = { todo: "active", active: "done", done: "todo", waiting: "done" };

function nextStd(v, list) { return list.find((x) => x >= v) || list[list.length - 1]; }

const DocIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" /></svg>
);

export default function ConnectionPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Connection pipeline — VoltMira Studio"; }, []);

  const trackKey = "voltmira_studio_pipeline_" + (String(client.contractNo || "default").replace(/[^\w-]/g, "") || "default");

  const [env, setEnv] = useState({ insulation: true, windows: false });
  const [track, setTrack] = useState({});     // { [stageId]: status }
  const [doneRisks, setDoneRisks] = useState({});
  const [flash, setFlash] = useState("");

  // load saved state for this contract
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(trackKey) || "{}");
      setTrack(s.track || {});
      setDoneRisks(s.risks || {});
      if (s.env) setEnv(s.env);
    } catch { setTrack({}); setDoneRisks({}); }
  }, [trackKey]);

  const persist = useCallback((patch) => {
    try {
      const cur = JSON.parse(localStorage.getItem(trackKey) || "{}");
      localStorage.setItem(trackKey, JSON.stringify({ ...cur, ...patch }));
    } catch { /* private mode */ }
  }, [trackKey]);

  const setEnvP = (p) => { const n = { ...env, ...p }; setEnv(n); persist({ env: n }); };

  const op = useMemo(() => resolveOperator(client.address), [client.address]);
  const commercial = (+client.kw || 0) >= 30;

  const eng = useMemo(() => {
    const E = engineSettings();
    const kw = +client.kw || 0;
    const project = {
      market: "MD", kw, price: +client.price || 0.185,
      cons: +client.cons || 0, batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0,
      yieldOverride: 1180,
    };
    const sim = simulate(project, E, "expc");
    const panel = DEMO_SYSTEM.panel;
    const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
    const dcKw = (modules * panel.watt) / 1000;
    const invKw = nextStd(dcKw / 1.15, [3, 3.6, 5, 6, 8, 10, 12, 15, 20, 25, 33, 50, 75, 110, 150, 200, 250]);
    return { capexEur: sim.grossCost, payback: sim.payback, modules, dcKw, invKw, panel };
  }, [client]);

  const feerm = useMemo(() => {
    const eligible = env.insulation && env.windows;
    const capexMdl = eng.capexEur * FX.MDL;
    const grantMdl = Math.min(200000, Math.round((capexMdl * 0.5) / 1000) * 1000);
    const blocker = !env.insulation ? "insulation" : !env.windows ? "windows" : null;
    return { eligible, grantMdl, capexMdl, sharePct: capexMdl > 0 ? (grantMdl / capexMdl) * 100 : 0, blocker };
  }, [env, eng]);

  const usedPct = Math.min(100, (op.usedMw / op.capMw) * 100);
  const headroomMw = op.capMw - op.usedMw;
  const tight = headroomMw < op.capMw * 0.18;

  const phases = client.phases === 3 ? "3~ 400 V" : "1~ 230 V";
  const approvedKw = Math.max(Math.ceil(+client.kw || 0), client.phases === 3 ? 12 : 8);

  const baseStages = [
    { id: "signed", label: { ro: "Ofertă semnată", en: "Offer signed", ru: "Предложение подписано" }, base: "done", docs: [] },
    {
      id: "atr", label: { ro: "Dosar de racordare (ATR)", en: "Connection file (ATR)", ru: "Пакет на подключение (ATR)" }, base: "active",
      docs: [
        { ro: "Cerere pentru avizul de racordare", en: "Connection-certificate application", ru: "Заявление на разрешение" },
        { ro: "Memoriu tehnic + schemă monofilară", en: "Technical memo + single-line diagram", ru: "Техническое описание + схема" },
        { ro: "Breviar de calcul al puterii", en: "Installed-power calculation", ru: "Расчёт мощности" },
        { ro: "Copie act de proprietate", en: "Property title copy", ru: "Копия документа о собственности" },
      ],
    },
    { id: "aviz", label: { ro: "Aviz tehnic de racordare", en: "Technical connection certificate", ru: "Техническое разрешение" }, base: "waiting", hint: { ro: "termen legal ~30 de zile", en: "~30 days statutory", ru: "~30 дней по закону" }, docs: [] },
    { id: "install", label: { ro: "Montaj", en: "Installation", ru: "Монтаж" }, base: "todo", docs: [] },
    {
      id: "racordare", label: { ro: "Cerere de racordare + PIF", en: "Grid-connection request + commissioning", ru: "Заявка + пусконаладка" }, base: "todo",
      docs: [
        { ro: "Declarația electricianului autorizat", en: "Authorised-electrician declaration", ru: "Декларация электрика" },
        { ro: "Proces-verbal de punere în funcțiune", en: "Commissioning report", ru: "Акт ввода в эксплуатацию" },
      ],
    },
    { id: "meter", label: { ro: "Contor bidirecțional", en: "Bidirectional meter", ru: "Двунаправленный счётчик" }, base: "todo", hint: { ro: op.name + " montează contorul", en: op.name + " fits the meter", ru: op.name + " ставит счётчик" }, docs: [] },
    {
      id: "billing", label: { ro: "Contract & facturare", en: "Contract & invoicing", ru: "Договор и счета" }, base: "todo",
      docs: commercial
        ? [{ ro: "Contract de racordare", en: "Connection contract", ru: "Договор о подключении" }, { ro: "Act de predare-primire", en: "Handover protocol", ru: "Акт приёма-передачи" }, { ro: "Factură fiscală electronică (e-Factura SFS)", en: "Electronic tax invoice (SFS e-Factura)", ru: "Электронная накладная (e-Factura SFS)" }]
        : [{ ro: "Act de predare-primire", en: "Handover protocol", ru: "Акт приёма-передачи" }, { ro: "Factură fiscală", en: "Tax invoice", ru: "Налоговая накладная" }],
    },
  ];
  const statusOf = (s) => track[s.id] || s.base;
  const cycle = (s) => {
    const cur = statusOf(s);
    const n = NEXT_STATUS[cur] || "todo";
    const nt = { ...track, [s.id]: n };
    setTrack(nt); persist({ track: nt });
    setFlash(tx(s.label, lang) + " → " + tx(ST[n], lang)); setTimeout(() => setFlash(""), 1800);
  };
  const doneCount = baseStages.filter((s) => statusOf(s) === "done").length;

  const risks = [
    { id: "title", ok: true, label: { ro: "Act de proprietate — atașat", en: "Property title — attached", ru: "Документ о собственности — приложен" } },
    { id: "id", ok: true, label: { ro: "Buletin de identitate — atașat", en: "ID card — attached", ru: "Удостоверение личности — приложено" } },
    { id: "epc", ok: env.insulation, label: { ro: "Certificat de performanță energetică", en: "Energy-performance certificate", ru: "Сертификат энергоэффективности" } },
    { id: "deviz", ok: false, label: { ro: "Deviz de lucrări — ștampilat și semnat", en: "Works estimate — stamped & signed", ru: "Смета — с печатью и подписью" } },
    { id: "scans", ok: true, label: { ro: "Scanări ≥ 300 dpi, PDF < 10 MB", en: "Scans ≥ 300 dpi, PDF < 10 MB", ru: "Сканы ≥ 300 dpi, PDF < 10 МБ" } },
  ];
  const riskOk = (r) => r.ok || doneRisks[r.id];
  const markRisk = (id) => { const n = { ...doneRisks, [id]: true }; setDoneRisks(n); persist({ risks: n }); };

  const inbox = [];
  if (statusOf(baseStages[1]) !== "done") inbox.push({
    id: "clarify", tone: "act",
    text: { ro: op.name + " a cerut o clarificare la schema monofilară (secțiune cablu AC). VoltMira a pregătit corecția în memoriul tehnic de mai jos.", en: op.name + " asked for a clarification on the single-line diagram (AC cable size). VoltMira has prepared the fix in the technical memo below.", ru: op.name + " запросил уточнение по схеме (сечение кабеля AC). Исправление — в техническом описании ниже." },
    cta: { ro: "Marchează dosarul trimis", en: "Mark file submitted", ru: "Отметить пакет отправленным" }, act: () => cycle(baseStages[1]),
  });
  if (feerm.blocker) inbox.push({
    id: "feerm", tone: "warn",
    text: feerm.blocker === "insulation"
      ? { ro: "Dosarul Casa Verde este blocat: izolația termică trebuie finalizată înainte de panouri.", en: "The Casa Verde file is blocked: thermal insulation must be done before the panels.", ru: "Заявка Casa Verde заблокирована: сначала утепление." }
      : { ro: "Dosarul Casa Verde este blocat: ferestrele trebuie înlocuite înainte de panouri.", en: "The Casa Verde file is blocked: the windows must be replaced before the panels.", ru: "Заявка Casa Verde заблокирована: сначала замена окон." },
    cta: null,
  });
  if (tight) inbox.push({
    id: "slot", tone: "warn",
    text: { ro: "Rezerva de plafon în zona " + op.name + " scade (" + headroomMw.toFixed(0) + " MW din " + op.capMw + " MW). Depune dosarul ATR devreme.", en: "Headroom in the " + op.name + " area is shrinking (" + headroomMw.toFixed(0) + " of " + op.capMw + " MW). File the ATR early.", ru: "Резерв в зоне " + op.name + " сокращается (" + headroomMw.toFixed(0) + " из " + op.capMw + " МВт)." },
    cta: null,
  });

  const loc = lang === "en" ? "en-IE" : lang === "ru" ? "ru-RU" : "ro-RO";
  const today = new Date().toLocaleDateString(loc);
  const kv = (k, v) => <div className="doc-kv"><span>{k}</span><b>{v}</b></div>;
  const L = (ro, en) => (lang === "en" ? en : ro);

  return (
    <>
      <PreviewHeader slug="connection" lang={lang} title={T(TX.title)} sub={T(TX.sub)}
        right={<button className="btn ghost sm" onClick={printDoc}>{T(TX.gen)}</button>} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      <div className="pv-panel pv-noprint">
        <h3>{T(TX.opTitle)}</h3>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>{op.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
          {tx({ ro: op.areaRo, en: op.areaEn, ru: op.areaRu }, lang)} · {String(client.address).split(",").slice(-2).join(",").trim() || client.address}
        </div>
        <div className="rc-slot"><i style={{ width: usedPct + "%" }} /></div>
        <div className="rc-slot-lg">
          <span>{T(TX.allocated)} ~{op.usedMw.toFixed(1)} MW</span>
          <span>{T(TX.cap)} {op.capMw} MW</span>
        </div>
        <div className="pv-metrics" style={{ marginTop: 14 }}>
          <div className={"pv-metric" + (tight ? " warn" : " good")}><b>{headroomMw.toFixed(1)} MW</b><span>{T(TX.headroom)}</span></div>
          <div className="pv-metric"><b>{(+client.kw || 0).toFixed(1)} kW</b><span>{tx({ ro: "acest proiect", en: "this project", ru: "этот проект" }, lang)}</span></div>
          <div className="pv-metric"><b>{eng.payback == null ? "25+" : eng.payback.toFixed(1)}</b><span>{tx({ ro: "ani amortizare (P50)", en: "yr payback (P50)", ru: "лет окупаемости (P50)" }, lang)}</span></div>
          <div className="pv-metric"><b>{doneCount}/{baseStages.length}</b><span>{tx({ ro: "etape finalizate", en: "stages done", ru: "этапов готово" }, lang)}</span></div>
        </div>
      </div>

      <div className="pv-panel pv-noprint">
        <h3>{T(TX.feermTitle)}</h3>
        <div className="rc-gate">
          <label className="rc-toggle"><span>{T(TX.insulation)}</span>
            <div className="pv-seg">
              <button className={env.insulation ? "on" : ""} onClick={() => setEnvP({ insulation: true })}>{T(TX.done)}</button>
              <button className={!env.insulation ? "on" : ""} onClick={() => setEnvP({ insulation: false })}>{T(TX.notDone)}</button>
            </div>
          </label>
          <label className="rc-toggle"><span>{T(TX.windows)}</span>
            <div className="pv-seg">
              <button className={env.windows ? "on" : ""} onClick={() => setEnvP({ windows: true })}>{T(TX.done)}</button>
              <button className={!env.windows ? "on" : ""} onClick={() => setEnvP({ windows: false })}>{T(TX.notDone)}</button>
            </div>
          </label>
        </div>
        {feerm.eligible ? (
          <div className="rc-verdict ok"><div>
            <b>{T(TX.eligibleV)}</b><br />
            {T(TX.grantEst)}: <b>{NUM(feerm.grantMdl)} MDL</b> · {feerm.sharePct.toFixed(0)}% {T(TX.ofCapex)}
            {feerm.grantMdl >= 200000 ? " · " + tx({ ro: "plafon 200 000 MDL atins", en: "200,000 MDL ceiling reached", ru: "потолок 200 000 MDL" }, lang) : ""}
          </div></div>
        ) : (
          <div className="rc-verdict no"><div>{feerm.blocker === "insulation" ? T(TX.blockedIns) : T(TX.blockedWin)}</div></div>
        )}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--muted)", margin: "16px 0 0" }}>{T(TX.riskTitle)}</div>
        <ul className="rc-risks">
          {risks.map((r) => (
            <li key={r.id}>
              <span className={"rc-ic " + (riskOk(r) ? "y" : "n")}>{riskOk(r) ? "✓" : "!"}</span>
              <span style={{ opacity: riskOk(r) ? 1 : 0.85 }}>{tx(r.label, lang)}</span>
              {!riskOk(r) && <button className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={() => markRisk(r.id)}>{T(TX.fixed)}</button>}
            </li>
          ))}
        </ul>
      </div>

      <div className="pv-panel pv-noprint">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{T(TX.flowTitle)}</h3>
          <button className="btn ghost sm" onClick={() => { setTrack({}); setDoneRisks({}); persist({ track: {}, risks: {} }); }}>{T(TX.reset)}</button>
        </div>
        {flash && <div className="rc-flash">{flash}</div>}
        <ol className="rc-steps" style={{ marginTop: 14 }}>
          {baseStages.map((s) => {
            const st = statusOf(s);
            return (
              <li key={s.id} className="rc-step">
                <button className={"rc-mark rc-mark-btn " + (st === "done" ? "done" : st === "active" ? "active" : "")}
                  onClick={() => cycle(s)} title={tx({ ro: "schimbă starea", en: "change status", ru: "сменить статус" }, lang)}>
                  {st === "done" ? "✓" : st === "active" ? "•" : ""}
                </button>
                <div className="rc-step-b">
                  <div className="rc-step-h">
                    <b>{tx(s.label, lang)}</b>
                    <span>· {tx(ST[st], lang)}{s.hint && st !== "done" ? " · " + tx(s.hint, lang) : ""}</span>
                  </div>
                  {s.docs.length > 0 && (
                    <div className="rc-docs">{s.docs.map((d, i) => <span key={i} className="rc-doc"><DocIcon />{tx(d, lang)}</span>)}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {inbox.length > 0 && (
        <div className="pv-panel pv-noprint">
          <h3>{T(TX.inboxTitle)}</h3>
          <ul className="rc-inbox">
            {inbox.map((it) => (
              <li key={it.id} className={it.tone}>
                <p>{tx(it.text, lang)}</p>
                {it.cta && <button className="btn sm ghost" onClick={it.act}>{tx(it.cta, lang)}</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pv-callout pv-noprint">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <p>{T(TX.reframe)}</p>
      </div>

      {/* ---- the real documents (print → PDF) ---- */}
      <div className="pv-doc-scroll">
        <div className="pv-doc">
          <div className="doc-co">VoltMira · {today} · {L("verificați cu electricianul autorizat", "verify with your authorised electrician")}</div>

          <h1>{L("CERERE pentru avizul de racordare — prosumator", "CONNECTION-CERTIFICATE APPLICATION — prosumer")}</h1>
          <p className="doc-sub">{L("Către", "To")}: <b>{op.name}</b></p>
          <div className="doc-grid">
            {kv(L("Solicitant", "Applicant"), client.name)}
            {kv(L("Nr. contract furnizare", "Supply contract no."), client.contractNo)}
            {kv(L("Adresa locului de consum", "Consumption site address"), client.address)}
            {kv(L("Putere aprobată consum", "Approved consumption power"), approvedKw + " kW")}
            {kv(L("Putere instalată DC solicitată", "Requested installed DC power"), eng.dcKw.toFixed(2) + " kWp")}
            {kv(L("Putere maximă evacuată AC", "Max AC export power"), Math.min(eng.invKw, eng.dcKw).toFixed(2) + " kW · " + phases)}
            {kv(L("Schema de compensare", "Compensation scheme"), L("facturare netă (net billing)", "net billing"))}
            {kv(L("Instalator autorizat", "Authorised installer"), client.atestat || "ANRE-MC nr. 2026/PV-0148")}
          </div>
          <p className="doc-note">{L(
            "Anexez: memoriu tehnic și schemă electrică monofilară, breviar de calcul al puterii instalate, copie act de proprietate, copie buletin de identitate. Solicit stabilirea condițiilor tehnice și a soluției de racordare pentru instalația de producere descrisă.",
            "Enclosed: technical memo and single-line diagram, installed-power calculation, property title copy, ID copy. I request the technical conditions and connection solution for the generating installation described.")}</p>
          <div className="doc-sign"><div>{L("Solicitant (nume, semnătură)", "Applicant (name, signature)")}</div><div>{L("Data", "Date")}: {today}</div></div>

          <h2>{L("MEMORIU TEHNIC (simplificat)", "TECHNICAL MEMO (simplified)")}</h2>
          <h3>{L("1. Instalația fotovoltaică", "1. PV installation")}</h3>
          <div className="doc-grid">
            {kv(L("Module", "Modules"), eng.modules + " × " + eng.panel.brand + " " + eng.panel.model + " (" + eng.panel.watt + " Wp)")}
            {kv(L("Putere DC / AC", "DC / AC power"), eng.dcKw.toFixed(2) + " kWp / " + eng.invKw + " kW")}
            {kv(L("Invertor", "Inverter"), DEMO_SYSTEM.inverter.brand + " " + DEMO_SYSTEM.inverter.model + " · " + phases)}
            {kv(L("Stocare", "Storage"), (+client.batteryKwh || 0) > 0 ? client.batteryKwh + " kWh · LiFePO₄" : "—")}
            {kv(L("Contor", "Meter"), L("bidirecțional, 4 cadrane, clasa 1", "bidirectional, 4-quadrant, class 1"))}
            {kv(L("Cablu racord AC", "AC connection cable"), (client.phases === 3 ? "5G6 mm² Cu" : "3G6 mm² Cu"))}
          </div>
          <h3>{L("2. Protecții de interfață — SR EN 50549-1", "2. Interface protections — SR EN 50549-1")}</h3>
          <table>
            <thead><tr><th>{L("Funcție", "Function")}</th><th style={{ width: 150 }}>{L("Prag", "Setting")}</th><th style={{ width: 110 }}>{L("Timp", "Time")}</th></tr></thead>
            <tbody>{PROTECTION.map((p) => <tr key={p.fn}><td>{p.fn}</td><td>{p.set}</td><td>{p.time}</td></tr>)}</tbody>
          </table>
          <p className="doc-note">{L(
            "Invertorul deține certificat de conformitate cu codul de rețea și funcție anti-insularizare (LoM). Instalația nu debitează în rețea în absența tensiunii din rețea. Proiectare conform SR HD 60364-7-712.",
            "The inverter holds a grid-code conformity certificate and loss-of-mains protection. The installation does not feed the grid without grid voltage. Designed to SR HD 60364-7-712.")}</p>

          <h2>{L("BORDEROU — dosar Casa Verde (FEERM)", "CHECKLIST — Casa Verde (FEERM) application")}</h2>
          <div className="doc-grid">
            {kv(L("Beneficiar", "Beneficiary"), client.name)}
            {kv(L("Măsură solicitată", "Requested measure"), L("panouri fotovoltaice cu baterii de acumulare", "PV panels with storage battery"))}
            {kv(L("Valoare estimată lucrări", "Estimated works value"), NUM(feerm.capexMdl) + " MDL")}
            {kv(L("Grant solicitat (≤ 50%, plafon 200 000 MDL)", "Grant requested (≤ 50%, cap 200,000 MDL)"), NUM(feerm.grantMdl) + " MDL")}
            {kv(L("Condiție de eligibilitate PV", "PV eligibility condition"), feerm.eligible ? L("îndeplinită (izolație + ferestre)", "met (insulation + windows)") : L("NEîndeplinită", "NOT met"))}
          </div>
          <table>
            <thead><tr><th>{L("Document", "Document")}</th><th style={{ width: 90 }}>{L("Stare", "Status")}</th></tr></thead>
            <tbody>
              {[
                [L("Cerere de finanțare (feerm.md)", "Funding application (feerm.md)"), true],
                [L("Act de proprietate asupra locuinței", "Home ownership title"), true],
                [L("Copie buletin de identitate", "ID card copy"), true],
                [L("Certificat de performanță energetică", "Energy-performance certificate"), env.insulation],
                [L("Deviz de lucrări ștampilat și semnat", "Works estimate, stamped & signed"), !!doneRisks.deviz],
                [L("Dovada finalizării izolației termice", "Proof of completed thermal insulation"), env.insulation],
                [L("Dovada înlocuirii ferestrelor", "Proof of replaced windows"), env.windows],
                [L("Ofertă tehnică + schemă monofilară", "Technical offer + single-line diagram"), true],
                [L("Extras de cont bancar", "Bank account statement"), true],
              ].map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1] ? "✓ " + L("gata", "ready") : "— " + L("lipsă", "missing")}</td></tr>)}
            </tbody>
          </table>
          <p className="doc-note">{L(
            "Regula programului: panourile fotovoltaice sunt eligibile doar după realizarea măsurilor de reducere a consumului (izolație termică, înlocuirea ferestrelor). Depunere online pe feerm.md.",
            "Programme rule: PV panels are eligible only after consumption-reduction measures (thermal insulation, window replacement). Submit online at feerm.md.")}</p>
          <div className="doc-sign"><div>{L("Instalator autorizat (nume, semnătură, ștampilă)", "Authorised installer (name, signature, stamp)")}</div><div>{L("Beneficiar (nume, semnătură)", "Beneficiary (name, signature)")}</div></div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .rc-slot{height:12px;border-radius:99px;background:var(--paper);border:1px solid var(--line);overflow:hidden;margin:12px 0 4px}
        .rc-slot i{display:block;height:100%;background:var(--green);opacity:.85}
        .rc-slot-lg{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
        .rc-gate{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px}
        .rc-toggle{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:600;color:var(--muted)}
        .rc-verdict{display:flex;gap:10px;border-radius:11px;padding:12px 14px;font-size:13px;line-height:1.55}
        .rc-verdict.ok{background:var(--green-tint);color:var(--ink)}
        .rc-verdict.no{background:var(--amber-tint);color:var(--ink)}
        .rc-risks{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:8px}
        .rc-risks li{display:flex;gap:9px;align-items:center;font-size:12.5px;color:var(--ink)}
        .rc-ic{flex:none;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700}
        .rc-ic.y{background:var(--green-tint);color:var(--green)}
        .rc-ic.n{background:var(--amber-tint);color:#B4700F}
        .rc-flash{margin-top:12px;font-size:12px;font-weight:600;color:var(--green);background:var(--green-tint);border-radius:8px;padding:8px 11px}
        .rc-steps{margin:0;padding:0;list-style:none}
        .rc-step{display:flex;gap:14px;position:relative;padding-bottom:18px}
        .rc-step::before{content:"";position:absolute;left:11px;top:24px;bottom:0;width:2px;background:var(--line)}
        .rc-step:last-child::before{display:none}.rc-step:last-child{padding-bottom:0}
        .rc-mark{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--line);
          background:var(--paper-2);z-index:1;font-size:12px;font-weight:700;color:#fff;line-height:1}
        .rc-mark-btn{cursor:pointer;font-family:inherit;padding:0;transition:transform .1s}
        .rc-mark-btn:hover{transform:scale(1.12)}
        .rc-mark.done{background:var(--green);border-color:var(--green)}
        .rc-mark.active{border-color:var(--green);color:var(--green)}
        .rc-step-b{flex:1;min-width:0;padding-top:1px}
        .rc-step-h{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
        .rc-step-h b{font-size:13.5px;font-weight:700;color:var(--ink)}
        .rc-step-h span{font-size:11.5px;color:var(--muted)}
        .rc-docs{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
        .rc-doc{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--muted);
          background:var(--paper);border:1px solid var(--line);border-radius:7px;padding:4px 8px}
        .rc-inbox{list-style:none;margin:0;padding:0;display:grid;gap:10px}
        .rc-inbox li{background:var(--paper);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:10px;padding:12px 14px}
        .rc-inbox li.act{border-left-color:var(--green)}
        .rc-inbox li.warn{border-left-color:var(--amber)}
        .rc-inbox p{margin:0;font-size:12.5px;color:var(--ink);line-height:1.55}
        .rc-inbox .btn{margin-top:9px}
      ` }} />
    </>
  );
}
