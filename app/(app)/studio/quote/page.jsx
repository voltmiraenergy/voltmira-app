"use client";
// Studio · Offer (Residential + C&I).
// One offer surface with two modes:
//  · Residential — every Moldovan rule in it: the 10 kW cap, net metering vs net
//    billing per client, the real Casa Verde / FEERM maths, lei first, design
//    sanity checks, and a homeowner-facing offer.
//  · C&I — mega projects (100 kW+): self-consumption, a capex breakdown,
//    NPV / IRR / LCOE, a payment schedule and delivery timeline, exported as a
//    full multi-page offer dossier.
// Mock chrome; every number is the shared VoltMira engine.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, downloadStudioDoc,
  useStudioClient, ClientBar, engineSettings, DEMO_SYSTEM,
} from "../studio-kit.jsx";
import { simulate, FX, effectiveYield } from "../_engine.js";

const TX = {
  title: { en: "Offer", ro: "Ofertă", ru: "Предложение" },
  sub: {
    en: "One offer surface, two modes — Residential carries the 10 kW cap, net metering vs billing and the real Casa Verde / FEERM maths; C&I handles mega projects with self-consumption, NPV / IRR / LCOE and a full dossier. All on the live engine.",
    ro: "O singură ofertă, două moduri — Rezidențial poartă plafonul de 10 kW, contorizare vs facturare netă și matematica reală Casa Verde / FEERM; C&I acoperă proiectele mari cu autoconsum, VAN / RIR / LCOE și un dosar complet. Totul pe motorul live.",
    ru: "Одно предложение, два режима — Жилой несёт лимит 10 кВт, нетто-учёт/биллинг и математику Casa Verde / FEERM; C&I — мегапроекты с самопотреблением, NPV / IRR / LCOE и полным пакетом. Всё на живом движке.",
  },
  note: {
    en: "Switch modes at the top. Residential enforces the 10 kW cap and the grant gate; C&I drops them and adds the commercial financials. Every figure is the VoltMira engine on this client's inputs — try the 'Fabrica AgroNord' sample for a 300 kW C&I case.",
    ro: "Comută modul sus. Rezidențial impune plafonul de 10 kW și grila grantului; C&I le scoate și adaugă analiza financiară comercială. Fiecare cifră e motorul VoltMira pe datele acestui client — încearcă exemplul „Fabrica AgroNord” pentru un caz C&I de 300 kW.",
    ru: "Переключайте режим сверху. Жилой применяет лимит 10 кВт и грант; C&I убирает их и добавляет коммерческий анализ. Каждая цифра — движок VoltMira; попробуйте пример «Fabrica AgroNord» для C&I на 300 кВт.",
  },
  modeT: { en: "Offer mode", ro: "Tip ofertă", ru: "Тип предложения" },
  modeRes: { en: "Residential", ro: "Rezidențial", ru: "Жилой" },
  modeCi: { en: "Commercial & Industrial", ro: "Comercial & Industrial", ru: "Коммерческий" },
  clientLang: { en: "Offer language for this client", ro: "Limba ofertei pentru acest client", ru: "Язык предложения для клиента" },
  regime: { en: "Billing regime", ro: "Regim de facturare", ru: "Режим биллинга" },
  netmet: { en: "Net metering (pre-2024, 1:1)", ro: "Contorizare netă (înainte de 2024, 1:1)", ru: "Нетто-учёт (до 2024, 1:1)" },
  netbill: { en: "Net billing (2024+)", ro: "Facturare netă (2024+)", ru: "Нетто-биллинг (2024+)" },
  regimeNote: {
    en: "A prosumer connected before 2024 keeps 1:1 net metering — exports cancel imports at the retail price. Everyone since is on net billing: exports are credited at ≈ €0.07, so a battery pays off.",
    ro: "Un prosumator racordat înainte de 2024 păstrează contorizarea netă 1:1 — exportul anulează importul la prețul din factură. Toți cei de după sunt pe facturare netă: exportul se creditează la ≈ €0,07, deci bateria se amortizează.",
    ru: "Просьюмер, подключённый до 2024, сохраняет нетто-учёт 1:1 — экспорт гасит импорт по розничной цене. Все после — на нетто-биллинге: экспорт по ≈ €0,07, поэтому батарея окупается.",
  },
  // residential
  capOk: { en: "Within the 10 kW residential cap", ro: "În plafonul rezidențial de 10 kW", ru: "В пределах лимита 10 кВт для жилья" },
  capBlock: {
    en: "Over the 10 kW residential cap (since June 2025). A larger system is a different connection process — split it, or switch to C&I mode.",
    ro: "Peste plafonul rezidențial de 10 kW (din iunie 2025). Un sistem mai mare e alt proces de racordare — împarte-l, sau treci pe modul C&I.",
    ru: "Свыше лимита 10 кВт для жилья (с июня 2025). Большая система — другой процесс подключения — разделите или переключитесь на режим C&I.",
  },
  feerm: { en: "Casa Verde / FEERM", ro: "Casa Verde / FEERM", ru: "Casa Verde / FEERM" },
  insul: { en: "Insulation done", ro: "Izolație făcută", ru: "Утепление сделано" },
  windows: { en: "Windows replaced", ro: "Ferestre înlocuite", ru: "Окна заменены" },
  yes: { en: "yes", ro: "da", ru: "да" },
  no: { en: "no", ro: "nu", ru: "нет" },
  grantOk: { en: "Grant eligible", ro: "Eligibil pentru grant", ru: "Право на грант есть" },
  grantBlock: {
    en: "Not eligible yet — FEERM funds panels only after insulation and window replacement.",
    ro: "Încă neeligibil — FEERM finanțează panouri doar după izolație și înlocuirea ferestrelor.",
    ru: "Пока не проходит — FEERM финансирует панели только после утепления и замены окон.",
  },
  grantAmt: { en: "Grant (50%, cap 200,000 MDL)", ro: "Grant (50%, plafon 200 000 MDL)", ru: "Грант (50%, потолок 200 000 MDL)" },
  vstr: { en: "String Voc at −10 °C", ro: "Voc șir la −10 °C", ru: "Voc цепочки при −10 °C" },
  vWarn: { en: "over the inverter limit", ro: "peste limita invertorului", ru: "выше лимита инвертора" },
  battChk: { en: "Battery vs evening use", ro: "Baterie vs consum de seară", ru: "Батарея vs вечернее потребление" },
  battSmall: { en: "smaller than one evening — sized for backup, not savings", ro: "mai mică decât o seară — dimensionată pentru backup, nu economii", ru: "меньше одного вечера — для резерва, не экономии" },
  afterGrant: { en: "After grant", ro: "După grant", ru: "После гранта" },
  // C&I
  vat: { en: "VAT-registered buyer", ro: "Cumpărător plătitor de TVA", ru: "Покупатель — плательщик НДС" },
  disc: { en: "Discount rate (for NPV)", ro: "Rată de actualizare (pentru VAN)", ru: "Ставка дисконта (для NPV)" },
  ciNote: {
    en: "Commercial & industrial — no residential cap. A business self-consumes most of its production during working hours, so the return leans on avoided retail cost, not export. VAT is recoverable and the SFS e-Factura applies.",
    ro: "Comercial și industrial — fără plafon rezidențial. O firmă autoconsumă cea mai mare parte a producției în programul de lucru, deci randamentul se sprijină pe costul de rețea evitat, nu pe export. TVA e deductibil și se aplică e-Factura SFS.",
    ru: "Коммерческий и промышленный — без лимита для жилья. Бизнес потребляет большую часть выработки в рабочее время, поэтому доходность опирается на избегаемую розничную цену, а не на экспорт. НДС возмещается, применяется e-Factura SFS.",
  },
  invChk: { en: "Inverter block", ro: "Bloc invertoare", ru: "Блок инверторов" },
  connChk: { en: "Grid connection", ro: "Racordare la rețea", ru: "Подключение к сети" },
  selfChk: { en: "Self-consumption", ro: "Autoconsum", ru: "Самопотребление" },
  selfLow: { en: "low — most output is exported at the feed price; a bigger load or a battery lifts the return", ro: "scăzut — mare parte din producție se exportă la prețul de injecție; un consum mai mare sau o baterie cresc randamentul", ru: "низкое — большая часть уходит на экспорт; больше нагрузки или батарея повысят доходность" },
  npv: { en: "NPV", ro: "VAN", ru: "NPV" },
  irr: { en: "IRR", ro: "RIR", ru: "IRR" },
  lcoe: { en: "LCOE", ro: "LCOE", ru: "LCOE" },
  perkwp: { en: "per kWp", ro: "pe kWp", ru: "за кВт·п" },
  save1: { en: "Year-1 saving", ro: "Economie an 1", ru: "Экономия год 1" },
  prod: { en: "Production", ro: "Producție", ru: "Выработка" },
  // shared
  checks: { en: "Design & connection checks", ro: "Verificări de proiect și racordare", ru: "Проверки схемы и подключения" },
  clip: { en: "DC / AC ratio", ro: "Raport DC / AC", ru: "Отношение DC / AC" },
  clipWarn: { en: "high — ~{p}% clipping at midday in summer", ro: "mare — ~{p}% clipping la prânz vara", ru: "высокое — ~{p}% клиппинга в полдень летом" },
  clean: { en: "all clear — buildable as scoped", ro: "totul în regulă — fezabil ca proiectat", ru: "всё в порядке — реализуемо по проекту" },
  offer: { en: "The numbers, in lei", ro: "Cifrele, în lei", ru: "Цифры, в леях" },
  system: { en: "System", ro: "Sistem", ru: "Система" },
  turnkey: { en: "Turnkey", ro: "La cheie", ru: "Под ключ" },
  save25: { en: "25-year net", ro: "Net pe 25 de ani", ru: "Нетто за 25 лет" },
  pb: { en: "Payback", ro: "Amortizare", ru: "Окупаемость" },
  yrs: { en: "yrs", ro: "ani", ru: "лет" },
  pess: { en: "Pessimistic", ro: "Pesimist", ru: "Пессим." },
  expc: { en: "Expected", ro: "Așteptat", ru: "Ожид." },
  opti: { en: "Optimistic", ro: "Optimist", ru: "Оптим." },
};

const LANG_NAME = {
  ro: { ro: "română", en: "Romanian", ru: "румынском" },
  ru: { ro: "rusă", en: "Russian", ru: "русском" },
  en: { ro: "engleză", en: "English", ru: "английском" },
};

// Commercial-scale inverter block used for C&I systems (string inverter farm).
const CI_INV = { brand: "Huawei", model: "SUN2000-100KTL-M2", kw: 100 };
// Grid CO₂ intensity (kg/kWh) — avoided emissions. Regional ballpark.
const CO2 = { MD: 0.40, RO: 0.28 };

export default function QuotePreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Offer — VoltMira Studio"; }, []);

  const [mode, setMode] = useState("res");   // "res" | "ci"
  const [clientLang, setClientLang] = useState("ro");
  const [regime, setRegime] = useState("netbill");
  const [env, setEnv] = useState({ insul: true, windows: false });
  const [vatReg, setVatReg] = useState(true);
  const [disc, setDisc] = useState(6); // % discount rate for NPV

  const kw = +client.kw || 0;
  const capExceeded = mode === "res" && client.market === "MD" && kw > 10;

  const E = useMemo(() => engineSettings(), []);
  const eng = useMemo(() => {
    const mkt = regime === "netmet" ? "RO" : "MD";
    const base = {
      market: mkt, kw, price: +client.price || 0.185, cons: +client.cons || 0,
      batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0, yieldOverride: effectiveYield(client),
    };
    return { p: simulate(base, E, "pess"), e: simulate(base, E, "expc"), o: simulate(base, E, "opti") };
  }, [client, regime, kw, E]);

  const sim = eng.e;
  const grossEur = sim.grossCost;

  // ---- residential grant ----------------------------------------------------
  const grant = useMemo(() => {
    const eligible = env.insul && env.windows;
    const capexMdl = grossEur * FX.MDL;
    const amt = Math.min(200000, Math.round((capexMdl * 0.5) / 1000) * 1000);
    return { eligible, amtMdl: eligible ? amt : 0, amtEur: eligible ? amt / FX.MDL : 0 };
  }, [env, grossEur]);

  // ---- C&I financial analysis (NPV / IRR / LCOE) ----------------------------
  const fin = useMemo(() => {
    const cost = grossEur;
    const nets = []; let prev = -cost;
    for (const c of sim.rows) { nets.push(c - prev); prev = c; }
    const d = disc / 100;
    const npvAt = (r) => nets.reduce((a, n, i) => a + n / Math.pow(1 + r, i + 1), -cost);
    const npv = npvAt(d);
    let irr = null;
    if (npvAt(-0.5) * npvAt(1.5) < 0) {
      let lo = -0.5, hi = 1.5;
      for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (npvAt(m) > 0) lo = m; else hi = m; }
      irr = (lo + hi) / 2;
    }
    const b = E.bands.expc, H = E.horizon || 25;
    let dcost = cost, dprod = 0;
    for (let y = 1; y <= H; y++) {
      const prod = sim.prod0 * Math.pow(1 - b.degr / 100, y - 1);
      const opex = cost * (E.opexPct / 100) * Math.pow(1 + b.infl / 100, y - 1);
      dcost += opex / Math.pow(1 + d, y);
      dprod += prod / Math.pow(1 + d, y);
    }
    const lcoe = dprod > 0 ? dcost / dprod : 0;
    return { npv, irr, lcoe };
  }, [sim, grossEur, disc, E]);

  // ---- system build-up (both modes) -----------------------------------------
  const panel = DEMO_SYSTEM.panel;
  const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
  const dcKw = (modules * panel.watt) / 1000;
  const effY = effectiveYield(client);
  const prodKwh = sim.prod0;
  const invMaxV = client.phases === 3 ? 800 : 500;

  // residential single/small inverter sizing + string check
  const resInvKw = Math.max(3, Math.round((dcKw / 1.15) / 0.5) * 0.5);
  const resDcac = dcKw / resInvKw;
  const resClip = resDcac > 1.3 ? Math.round((resDcac - 1.15) * 22) : 0;
  const strings = dcKw > 5.2 ? Math.max(2, Math.ceil(dcKw / 5.5)) : 1;
  const vCold = Math.ceil(modules / strings) * panel.voc * 1.11;
  const vWarn = vCold > invMaxV;
  const battKwh = +client.batteryKwh || 0;
  const eveningKwh = ((+client.cons || 0) / 365) * 0.5;
  const battSmall = battKwh > 0 && battKwh < eveningKwh * 0.7;

  // C&I inverter block + connection level
  const ciNInv = Math.max(1, Math.ceil((dcKw / 1.2) / CI_INV.kw));
  const ciAcKw = ciNInv * CI_INV.kw;
  const ciDcac = dcKw / ciAcKw;
  const ciClip = ciDcac > 1.3 ? Math.round((ciDcac - 1.15) * 22) : 0;
  const mvLevel = kw > 100;
  const selfPct = Math.round((sim.self || 0) * 100);
  const selfLow = selfPct < 45;
  const co2t = (prodKwh * (CO2[client.market] || CO2.MD)) / 1000;

  // ---- money helpers --------------------------------------------------------
  const lei = (e) => NUM(e * FX.MDL) + " lei";
  const eur = (e) => "€" + NUM(e);
  const netEur = Math.max(0, grossEur - grant.amtEur);
  const life = sim.rows.length ? sim.rows[sim.rows.length - 1] : 0;
  const perKwp = kw > 0 ? grossEur / kw : 0;
  const pbTxt = (v) => (v == null ? "25+" : v.toFixed(1));

  const oc = (o) => tx(o, clientLang);
  const ocLoc = clientLang === "ru" ? "ru-RU" : clientLang === "en" ? "en-IE" : "ro-RO";
  const today = new Date().toLocaleDateString(ocLoc);
  const validUntil = new Date(Date.now() + (E.quoteValidityDays || 30) * 864e5).toLocaleDateString(ocLoc);
  const loc2 = (e) => `${lei(e)}`;

  // C&I capex / payment / timeline tables
  const CAPEX = [
    ["mod", { ro: "Module fotovoltaice", en: "PV modules", ru: "ФЭ-модули" }, 0.42, `${modules} × ${panel.watt} W ${panel.brand}`],
    ["inv", { ro: "Invertoare", en: "Inverters", ru: "Инверторы" }, 0.14, `${ciNInv} × ${CI_INV.kw} kW ${CI_INV.brand}`],
    ["mnt", { ro: "Structură de montaj", en: "Mounting structure", ru: "Несущая конструкция" }, 0.12, clientLang === "en" ? "flat-roof / trapezoidal sheet" : "acoperiș terasă / tablă cutată"],
    ["ele", { ro: "Electrice DC/AC, protecții, tablouri", en: "DC/AC electrical, protections, switchboards", ru: "DC/AC, защиты, щиты" }, 0.13, mvLevel ? (clientLang === "en" ? "incl. MV interface" : "incl. interfață MT") : "LV"],
    ["lab", { ro: "Montaj și punere în funcțiune", en: "Installation & commissioning", ru: "Монтаж и пусконаладка" }, 0.11, ""],
    ["eng", { ro: "Proiectare, avize, monitorizare", en: "Design, permits, monitoring", ru: "Проект, согласования, мониторинг" }, 0.08, clientLang === "en" ? "incl. export limitation" : "incl. limitare export"],
  ];
  const PAY = [
    [{ ro: "La semnarea contractului", en: "On contract signature", ru: "При подписании договора" }, 0.30],
    [{ ro: "La livrarea echipamentelor pe șantier", en: "On delivery of equipment to site", ru: "При поставке оборудования" }, 0.40],
    [{ ro: "La finalizarea montajului", en: "On completion of installation", ru: "По завершении монтажа" }, 0.25],
    [{ ro: "La punerea în funcțiune (garanție de bună execuție)", en: "On commissioning (retention)", ru: "При вводе (гарантийное удержание)" }, 0.05],
  ];
  const TL = [
    [{ ro: "Contractare și proiect tehnic", en: "Contract & detailed design", ru: "Договор и рабочий проект" }, "1–2"],
    [{ ro: "Avize și aviz tehnic de racordare (ATR)", en: "Permits & grid connection approval (ATR)", ru: "Согласования и ТУ на подключение" }, mvLevel ? "6–10" : "4–6"],
    [{ ro: "Aprovizionare echipamente", en: "Equipment procurement", ru: "Закупка оборудования" }, "3–5"],
    [{ ro: "Montaj pe șantier", en: "On-site installation", ru: "Монтаж на объекте" }, kw > 200 ? "4–6" : "2–4"],
    [{ ro: "Punere în funcțiune și energizare", en: "Commissioning & energization", ru: "Пусконаладка и включение" }, "1–2"],
  ];

  return (
    <>
      <PreviewHeader slug="quote" lang={lang} title={T(TX.title)} sub={T(TX.sub)}
        right={<button className="btn ghost sm" onClick={() => downloadStudioDoc((mode === "ci" ? "oferta-ci-" : "oferta-") + (client.ref || "voltmira"))}>{tx({ en: "Download offer PDF", ro: "Descarcă oferta PDF", ru: "Скачать PDF" }, lang)}</button>} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      {/* mode + per-client controls */}
      <div className="pv-panel">
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{T(TX.modeT)}</label>
        <div className="pv-seg" style={{ marginBottom: 16 }}>
          <button className={mode === "res" ? "on" : ""} onClick={() => setMode("res")}>{T(TX.modeRes)}</button>
          <button className={mode === "ci" ? "on" : ""} onClick={() => setMode("ci")}>{T(TX.modeCi)}</button>
        </div>
        <div className="qt-grid">
          <label>{T(TX.clientLang)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              {["ro", "ru", "en"].map((l) => (
                <button key={l} className={clientLang === l ? "on" : ""} onClick={() => setClientLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </label>
          {mode === "ci" && (
            <label>{T(TX.vat)}
              <div className="pv-seg" style={{ marginTop: 6 }}>
                <button className={vatReg ? "on" : ""} onClick={() => setVatReg(true)}>{T(TX.yes)}</button>
                <button className={!vatReg ? "on" : ""} onClick={() => setVatReg(false)}>{T(TX.no)}</button>
              </div>
            </label>
          )}
          <label style={{ gridColumn: "1 / -1" }}>{T(TX.regime)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              <button className={regime === "netbill" ? "on" : ""} onClick={() => setRegime("netbill")}>{T(TX.netbill)}</button>
              <button className={regime === "netmet" ? "on" : ""} onClick={() => setRegime("netmet")}>{T(TX.netmet)}</button>
            </div>
          </label>
          {mode === "ci" && (
            <label style={{ gridColumn: "1 / -1" }}>{T(TX.disc)} <output style={{ color: "var(--green)", fontWeight: 700 }}>{disc.toFixed(1)}%</output>
              <input type="range" min="3" max="12" step="0.5" value={disc}
                style={{ "--fill": ((disc - 3) / 9) * 100 + "%", marginTop: 6 }}
                onChange={(e) => setDisc(+e.target.value)} />
            </label>
          )}
        </div>
        {mode === "res" && <p className="qt-hint">{T(TX.regimeNote)}</p>}
        <p className="qt-langline">{tx({
          ro: `Oferta, contractul și dosarul de racordare pentru acest client se generează în ${LANG_NAME[clientLang].ro}` + (clientLang !== lang ? ` — independent de limba în care lucrezi tu acum.` : `.`),
          en: `This client's offer, contract and connection file are generated in ${LANG_NAME[clientLang].en}` + (clientLang !== lang ? ` — independent of the language you're working in.` : `.`),
          ru: `Предложение, договор и пакет на подключение этого клиента формируются на ${LANG_NAME[clientLang].ru}` + (clientLang !== lang ? ` — независимо от языка, на котором работаете вы.` : `.`),
        }, lang)}</p>
        {mode === "res" ? (
          <div className={"qt-flag " + (capExceeded ? "bad" : "ok")}>
            {capExceeded ? T(TX.capBlock) : T(TX.capOk)} · {kw.toFixed(1)} kW
          </div>
        ) : (
          <div className="qt-flag ok">{T(TX.ciNote)} · {kw.toFixed(0)} kWp</div>
        )}
      </div>

      {/* residential: FEERM */}
      {mode === "res" && (
        <div className="pv-panel">
          <h3>{T(TX.feerm)}</h3>
          <div className="qt-toggles">
            <label>{T(TX.insul)}
              <div className="pv-seg"><button className={env.insul ? "on" : ""} onClick={() => setEnv((e) => ({ ...e, insul: true }))}>{T(TX.yes)}</button>
                <button className={!env.insul ? "on" : ""} onClick={() => setEnv((e) => ({ ...e, insul: false }))}>{T(TX.no)}</button></div></label>
            <label>{T(TX.windows)}
              <div className="pv-seg"><button className={env.windows ? "on" : ""} onClick={() => setEnv((e) => ({ ...e, windows: true }))}>{T(TX.yes)}</button>
                <button className={!env.windows ? "on" : ""} onClick={() => setEnv((e) => ({ ...e, windows: false }))}>{T(TX.no)}</button></div></label>
          </div>
          {grant.eligible ? (
            <div className="qt-flag ok">{T(TX.grantOk)} · {T(TX.grantAmt)}: <b>{NUM(grant.amtMdl)} lei</b> ({eur(grant.amtEur)})</div>
          ) : (
            <div className="qt-flag bad">{T(TX.grantBlock)}</div>
          )}
        </div>
      )}

      {/* design & connection checks */}
      <div className="pv-panel">
        <h3>{T(TX.checks)}</h3>
        {mode === "res" ? (
          <ul className="qt-checks">
            <li className={resClip > 8 ? "warn" : "ok"}>
              <span>{resClip > 8 ? "!" : "✓"}</span>{T(TX.clip)}: <b>{resDcac.toFixed(2)}</b>
              {resClip > 8 ? " — " + tx({ ...TX.clipWarn }, lang).replace("{p}", resClip) : ""}
            </li>
            <li className={vWarn ? "warn" : "ok"}>
              <span>{vWarn ? "!" : "✓"}</span>{T(TX.vstr)}: <b className={vWarn ? "qt-bad" : ""}>{vCold.toFixed(0)} V</b> / {invMaxV} V{vWarn ? " — " + T(TX.vWarn) : ""}
            </li>
            <li className={battSmall ? "warn" : "ok"}>
              <span>{battSmall ? "!" : "✓"}</span>{T(TX.battChk)}: <b>{battKwh || "—"} kWh</b> / {eveningKwh.toFixed(1)} kWh{battSmall ? " — " + T(TX.battSmall) : ""}
            </li>
          </ul>
        ) : (
          <ul className="qt-checks">
            <li className={ciClip > 8 ? "warn" : "ok"}>
              <span>{ciClip > 8 ? "!" : "✓"}</span>{T(TX.clip)}: <b>{ciDcac.toFixed(2)}</b>
              {ciClip > 8 ? " — " + tx({ ...TX.clipWarn }, lang).replace("{p}", ciClip) : ""}
            </li>
            <li className="ok"><span>✓</span>{T(TX.invChk)}: <b>{ciNInv} × {CI_INV.kw} kW</b> {CI_INV.brand} · {ciAcKw} kW AC / {dcKw.toFixed(0)} kWp DC</li>
            <li className="ok"><span>✓</span>{T(TX.connChk)}: <b>{mvLevel ? tx({ ro: "medie tensiune (MT) / racord dedicat", en: "medium voltage (MV) / dedicated feeder", ru: "среднее напряжение (СН)" }, lang) : tx({ ro: "joasă tensiune 0,4 kV, 3~", en: "low voltage 0.4 kV, 3-phase", ru: "низкое напряжение 0,4 кВ" }, lang)}</b></li>
            <li className={selfLow ? "warn" : "ok"}><span>{selfLow ? "!" : "✓"}</span>{T(TX.selfChk)}: <b>{selfPct}%</b>{selfLow ? " — " + T(TX.selfLow) : ""}</li>
          </ul>
        )}
        {mode === "res" && resClip <= 8 && !vWarn && !battSmall && <div className="qt-flag ok">{T(TX.clean)}</div>}
        {mode === "ci" && ciClip <= 8 && !selfLow && <div className="qt-flag ok">{T(TX.clean)}</div>}
      </div>

      {/* headline numbers */}
      <div className="pv-panel">
        <h3>{T(TX.offer)}</h3>
        {mode === "res" ? (
          <div className="pv-metrics">
            <div className="pv-metric"><b>{kw.toFixed(1)} kW{battKwh > 0 ? ` · ${battKwh} kWh` : ""}</b><span>{T(TX.system)}</span></div>
            <div className="pv-metric"><b>{lei(grossEur)}</b><span>{T(TX.turnkey)} · {eur(grossEur)}</span></div>
            {grant.eligible && <div className="pv-metric good"><b>{lei(netEur)}</b><span>{T(TX.afterGrant)} · {eur(netEur)}</span></div>}
            <div className="pv-metric"><b>{lei(life)}</b><span>{T(TX.save25)}</span></div>
          </div>
        ) : (
          <div className="pv-metrics">
            <div className="pv-metric"><b>{kw.toFixed(0)} kWp</b><span>{T(TX.system)} · {modules} {tx({ ro: "module", en: "modules", ru: "модулей" }, lang)}</span></div>
            <div className="pv-metric"><b>{NUM(prodKwh / 1000, 0)} MWh</b><span>{T(TX.prod)}/{tx({ ro: "an", en: "yr", ru: "год" }, lang)} · {selfPct}% {tx({ ro: "autoconsum", en: "self-used", ru: "самопотр." }, lang)}</span></div>
            <div className="pv-metric"><b>{lei(grossEur)}</b><span>{T(TX.turnkey)} · {eur(grossEur)}</span></div>
            <div className="pv-metric"><b>{eur(perKwp)}</b><span>{T(TX.perkwp)}</span></div>
            <div className="pv-metric good"><b>{lei(sim.year1)}</b><span>{T(TX.save1)}</span></div>
            <div className="pv-metric"><b>{lei(life)}</b><span>{T(TX.save25)}</span></div>
            <div className="pv-metric good"><b>{eur(fin.npv)}</b><span>{T(TX.npv)} @ {disc.toFixed(0)}%</span></div>
            <div className="pv-metric"><b>{fin.irr == null ? "—" : (fin.irr * 100).toFixed(1) + "%"}</b><span>{T(TX.irr)}</span></div>
            <div className="pv-metric"><b>€{fin.lcoe.toFixed(3)}</b><span>{T(TX.lcoe)} /kWh · {tx({ ro: "vs preț", en: "vs price", ru: "vs цена" }, lang)} €{(+client.price || 0.16).toFixed(3)}</span></div>
          </div>
        )}
        <div className="qt-bands">
          {[["pess", TX.pess, eng.p], ["expc", TX.expc, eng.e], ["opti", TX.opti, eng.o]].map(([k, lbl, b]) => (
            <div key={k} className={"qt-band " + k}>
              <div className="qt-band-t">{tx(lbl, lang)}</div>
              <div className="qt-band-y">{pbTxt(b.payback)} <small>{T(TX.yrs)} {T(TX.pb)}</small></div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- documents (only the active mode's .pv-doc is in the DOM → exported) ---- */}
      <div className="pv-doc-scroll">
        {mode === "res" ? (
          <div className="pv-doc">
            <div className="doc-co">VoltMira · {today} · {oc({ ro: "ofertă solară", en: "solar offer", ru: "солнечное предложение" })}</div>
            <h1>{oc({ ro: "Ofertă sistem fotovoltaic", en: "Solar system offer", ru: "Предложение по солнечной системе" })}</h1>
            <p className="doc-sub">{client.name}{client.address ? " · " + client.address : ""}</p>

            <h2>{oc({ ro: "Sistemul", en: "The system", ru: "Система" })}</h2>
            <div className="doc-grid">
              <div className="doc-kv"><span>{oc({ ro: "Putere instalată", en: "Installed power", ru: "Мощность" })}</span><b>{kw.toFixed(1)} kW{battKwh > 0 ? ` · ${battKwh} kWh` : ""}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Producție estimată", en: "Estimated yield", ru: "Оценка выработки" })}</span><b>{NUM(kw * effY)} kWh/{oc({ ro: "an", en: "yr", ru: "год" })}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Preț la cheie", en: "Turnkey price", ru: "Цена под ключ" })}</span><b>{lei(grossEur)} · {eur(grossEur)}</b></div>
              {grant.eligible && <div className="doc-kv"><span>{oc({ ro: "După grant", en: "After grant", ru: "После гранта" })}</span><b>{lei(netEur)} · {eur(netEur)}</b></div>}
              <div className="doc-kv"><span>{oc({ ro: "Economie brută pe 25 de ani", en: "25-year gross savings", ru: "Экономия за 25 лет" })}</span><b>{lei(sim.rows.length ? sim.rows[sim.rows.length - 1] + grossEur : 0)}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Schemă de compensare", en: "Compensation scheme", ru: "Схема компенсации" })}</span><b>{regime === "netbill" ? oc({ ro: "facturare netă", en: "net billing", ru: "нетто-биллинг" }) : oc({ ro: "contorizare netă 1:1", en: "net metering 1:1", ru: "нетто-учёт 1:1" })}</b></div>
            </div>

            <h2>{oc({ ro: "Amortizare — trei scenarii oneste", en: "Payback — three honest scenarios", ru: "Окупаемость — три честных сценария" })}</h2>
            <table>
              <thead><tr><th>{oc({ ro: "Scenariu", en: "Scenario", ru: "Сценарий" })}</th><th>{oc({ ro: "Amortizare", en: "Payback", ru: "Окупаемость" })}</th><th>{oc({ ro: "Ipoteze", en: "Assumptions", ru: "Допущения" })}</th></tr></thead>
              <tbody>
                <tr><td>{oc({ ro: "Pesimist", en: "Pessimistic", ru: "Пессимистичный" })}</td><td>{pbTxt(eng.p.payback)} {oc({ ro: "ani", en: "yrs", ru: "лет" })}</td><td>{oc({ ro: "randament −8%, inflație 0%", en: "yield −8%, inflation 0%", ru: "выработка −8%, инфляция 0%" })}</td></tr>
                <tr style={{ background: "#F0EEE6" }}><td><b>{oc({ ro: "Așteptat", en: "Expected", ru: "Ожидаемый" })}</b></td><td><b>{pbTxt(eng.e.payback)} {oc({ ro: "ani", en: "yrs", ru: "лет" })}</b></td><td>{oc({ ro: "randament de bază, degr. 0,5%/an, inflație 3%", en: "base yield, degr. 0.5%/yr, inflation 3%", ru: "базовая выработка, деград. 0,5%/год, инфляция 3%" })}</td></tr>
                <tr><td>{oc({ ro: "Optimist", en: "Optimistic", ru: "Оптимистичный" })}</td><td>{pbTxt(eng.o.payback)} {oc({ ro: "ani", en: "yrs", ru: "лет" })}</td><td>{oc({ ro: "randament +8%, inflație 5%", en: "yield +8%, inflation 5%", ru: "выработка +8%, инфляция 5%" })}</td></tr>
              </tbody>
            </table>
            <p className="doc-note">{oc({
              ro: "Cifrele sunt estimări pe motorul VoltMira, la ipotezele de mai sus și la randamentul specific al acestui sit. Ofertă orientativă până la vizita tehnică.",
              en: "Figures are estimates on the VoltMira engine at the assumptions above and this site's specific yield. Indicative until the site survey.",
              ru: "Цифры — оценки на движке VoltMira при указанных допущениях и удельной выработке этого объекта. Ориентировочно до техобследования.",
            })}</p>
            <div className="doc-sign">
              <div>{oc({ ro: "Instalator (nume, semnătură)", en: "Installer (name, signature)", ru: "Установщик (имя, подпись)" })}</div>
              <div>{oc({ ro: "Client (nume, semnătură)", en: "Client (name, signature)", ru: "Клиент (имя, подпись)" })}</div>
            </div>
          </div>
        ) : (
          <div className="pv-doc">
            <div className="doc-co">VoltMira · {today} · {oc({ ro: "ofertă comercială", en: "commercial offer", ru: "коммерческое предложение" })}</div>
            <h1>{oc({ ro: "Ofertă — sistem fotovoltaic la cheie", en: "Offer — turnkey photovoltaic system", ru: "Предложение — солнечная система под ключ" })}</h1>
            <p className="doc-sub">{client.name}{client.address ? " · " + client.address : ""}</p>
            <div className="doc-grid" style={{ marginTop: 10 }}>
              <div className="doc-kv"><span>{oc({ ro: "Nr. ofertă", en: "Offer no.", ru: "№ предложения" })}</span><b>{client.ref || "VM-CI-2026"}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Valabilă până la", en: "Valid until", ru: "Действительно до" })}</span><b>{validUntil}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Piață / schemă", en: "Market / scheme", ru: "Рынок / схема" })}</span><b>{client.market} · {regime === "netbill" ? oc({ ro: "facturare netă", en: "net billing", ru: "нетто-биллинг" }) : oc({ ro: "contorizare 1:1", en: "net metering 1:1", ru: "нетто-учёт 1:1" })}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Racordare", en: "Connection", ru: "Подключение" })}</span><b>{mvLevel ? oc({ ro: "MT / racord dedicat", en: "MV / dedicated", ru: "СН / выделенное" }) : oc({ ro: "JT 0,4 kV 3~", en: "LV 0.4 kV 3-phase", ru: "НН 0,4 кВ" })}</b></div>
            </div>

            <h2>{oc({ ro: "1 · Rezumat", en: "1 · Executive summary", ru: "1 · Резюме" })}</h2>
            <p>{oc({
              ro: `Propunem un sistem fotovoltaic la cheie de ${kw.toFixed(0)} kWp, cu o producție estimată de ${NUM(prodKwh / 1000, 0)} MWh în primul an, din care aproximativ ${selfPct}% se autoconsumă pe loc, la orele de program. Investiția la cheie este de ${lei(grossEur)} (${eur(grossEur)}), cu o amortizare așteptată de ${pbTxt(sim.payback)} ani și o valoare actualizată netă de ${eur(fin.npv)} la o rată de ${disc.toFixed(0)}%.`,
              en: `We propose a ${kw.toFixed(0)} kWp turnkey photovoltaic system producing an estimated ${NUM(prodKwh / 1000, 0)} MWh in year one, of which roughly ${selfPct}% is self-consumed on site during working hours. The turnkey investment is ${lei(grossEur)} (${eur(grossEur)}), with an expected payback of ${pbTxt(sim.payback)} years and a net present value of ${eur(fin.npv)} at a ${disc.toFixed(0)}% discount rate.`,
              ru: `Предлагаем ФЭ-систему под ключ на ${kw.toFixed(0)} кВт·п с выработкой ~${NUM(prodKwh / 1000, 0)} МВт·ч в первый год, из которых около ${selfPct}% потребляется на объекте в рабочее время. Инвестиция под ключ — ${lei(grossEur)} (${eur(grossEur)}), окупаемость ~${pbTxt(sim.payback)} лет, NPV ${eur(fin.npv)} при ставке ${disc.toFixed(0)}%.`,
            })}</p>
            <div className="doc-metrics">
              <div><b>{kw.toFixed(0)} kWp</b><span>{oc({ ro: "putere instalată", en: "installed power", ru: "мощность" })}</span></div>
              <div><b>{NUM(prodKwh / 1000, 0)} MWh</b><span>{oc({ ro: "producție an 1", en: "year-1 yield", ru: "выработка год 1" })}</span></div>
              <div><b>{pbTxt(sim.payback)} {oc({ ro: "ani", en: "yrs", ru: "лет" })}</b><span>{oc({ ro: "amortizare", en: "payback", ru: "окупаемость" })}</span></div>
              <div><b>{fin.irr == null ? "—" : (fin.irr * 100).toFixed(1) + "%"}</b><span>{oc({ ro: "RIR pe 25 ani", en: "25-yr IRR", ru: "IRR за 25 лет" })}</span></div>
            </div>

            <h2>{oc({ ro: "2 · Sistemul propus", en: "2 · System & scope of works", ru: "2 · Система и объём работ" })}</h2>
            <div className="doc-grid">
              <div className="doc-kv"><span>{oc({ ro: "Module", en: "Modules", ru: "Модули" })}</span><b>{modules} × {panel.watt} W · {panel.brand}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Putere DC", en: "DC power", ru: "Мощность DC" })}</span><b>{dcKw.toFixed(0)} kWp</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Invertoare", en: "Inverters", ru: "Инверторы" })}</span><b>{ciNInv} × {CI_INV.kw} kW · {CI_INV.brand}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Putere AC", en: "AC power", ru: "Мощность AC" })}</span><b>{ciAcKw} kW · DC/AC {ciDcac.toFixed(2)}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Structură", en: "Mounting", ru: "Конструкция" })}</span><b>{oc({ ro: "acoperiș / tablă cutată", en: "roof / trapezoidal sheet", ru: "крыша / профлист" })}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Monitorizare", en: "Monitoring", ru: "Мониторинг" })}</span><b>{oc({ ro: "portal + limitare export", en: "portal + export limiter", ru: "портал + ограничитель" })}</b></div>
            </div>
            <p className="doc-note">{oc({
              ro: "Scopul include proiectarea, furnizarea, montajul, protecțiile AC/DC, punerea în funcțiune, dosarul de racordare (ATR) și monitorizarea. Nu include lucrări de consolidare a structurii clădirii dacă expertiza tehnică le cere.",
              en: "Scope covers design, supply, installation, AC/DC protections, commissioning, the grid connection file (ATR) and monitoring. It excludes any building structural strengthening if the structural survey requires it.",
              ru: "В объём входят проект, поставка, монтаж, защиты AC/DC, пусконаладка, пакет на подключение и мониторинг. Не включает усиление конструкций здания, если этого требует обследование.",
            })}</p>

            <h2>{oc({ ro: "3 · Energie și performanță", en: "3 · Energy & performance", ru: "3 · Энергия и производительность" })}</h2>
            <table>
              <tbody>
                <tr><td>{oc({ ro: "Randament specific (sit)", en: "Specific yield (site)", ru: "Удельная выработка (объект)" })}</td><td className="r"><b>{NUM(effY)} kWh/kWp</b></td></tr>
                <tr><td>{oc({ ro: "Producție an 1", en: "Year-1 production", ru: "Выработка год 1" })}</td><td className="r"><b>{NUM(prodKwh)} kWh</b></td></tr>
                <tr><td>{oc({ ro: "Autoconsum estimat", en: "Estimated self-consumption", ru: "Оценка самопотребления" })}</td><td className="r"><b>{selfPct}%</b> · {NUM(prodKwh * (selfPct / 100))} kWh</td></tr>
                <tr><td>{oc({ ro: "Surplus exportat", en: "Exported surplus", ru: "Экспортируемый излишек" })}</td><td className="r">{NUM(prodKwh * (1 - selfPct / 100))} kWh</td></tr>
                <tr><td>{oc({ ro: "Degradare module", en: "Module degradation", ru: "Деградация модулей" })}</td><td className="r">≈ {E.bands.expc.degr}%/{oc({ ro: "an", en: "yr", ru: "год" })}</td></tr>
                <tr><td>{oc({ ro: "CO₂ evitat", en: "CO₂ avoided", ru: "CO₂ предотвращено" })}</td><td className="r">{NUM(co2t, 0)} t/{oc({ ro: "an", en: "yr", ru: "год" })} · {NUM(co2t * 25, 0)} t / 25 {oc({ ro: "ani", en: "yrs", ru: "лет" })}</td></tr>
              </tbody>
            </table>

            <h2>{oc({ ro: "4 · Defalcarea investiției", en: "4 · Investment breakdown", ru: "4 · Разбивка инвестиции" })}</h2>
            <table>
              <thead><tr><th>{oc({ ro: "Componentă", en: "Component", ru: "Компонент" })}</th><th>{oc({ ro: "Detaliu", en: "Detail", ru: "Детали" })}</th><th className="r">{oc({ ro: "Valoare (fără TVA)", en: "Value (excl. VAT)", ru: "Сумма (без НДС)" })}</th></tr></thead>
              <tbody>
                {CAPEX.map(([k, name, share, detail]) => (
                  <tr key={k}><td>{oc(name)}</td><td className="dim">{detail}</td><td className="r">{loc2(grossEur * share)}</td></tr>
                ))}
                <tr className="tot"><td><b>{oc({ ro: "Total la cheie (fără TVA)", en: "Turnkey total (excl. VAT)", ru: "Итого под ключ (без НДС)" })}</b></td><td></td><td className="r"><b>{loc2(grossEur)}</b></td></tr>
                <tr><td>{oc({ ro: "TVA 20%", en: "VAT 20%", ru: "НДС 20%" })}</td><td className="dim">{vatReg ? oc({ ro: "deductibil", en: "recoverable", ru: "возмещается" }) : ""}</td><td className="r">{loc2(grossEur * 0.2)}</td></tr>
                <tr className="tot"><td><b>{oc({ ro: "Total cu TVA", en: "Total incl. VAT", ru: "Итого с НДС" })}</b></td><td></td><td className="r"><b>{loc2(grossEur * 1.2)}</b></td></tr>
              </tbody>
            </table>
            <p className="doc-note">{oc({ ro: `Echivalent ${eur(grossEur)} fără TVA, la cursul BNM. Preț de referință ${eur(perKwp)}/kWp.`, en: `Equivalent to ${eur(grossEur)} excl. VAT at the BNM rate. Reference price ${eur(perKwp)}/kWp.`, ru: `Эквивалент ${eur(grossEur)} без НДС по курсу BNM. Ориентир ${eur(perKwp)}/кВт·п.` })}</p>

            <h2>{oc({ ro: "5 · Analiză financiară", en: "5 · Financial analysis", ru: "5 · Финансовый анализ" })}</h2>
            <table>
              <thead><tr><th>{oc({ ro: "Scenariu", en: "Scenario", ru: "Сценарий" })}</th><th className="r">{oc({ ro: "Amortizare", en: "Payback", ru: "Окупаемость" })}</th><th>{oc({ ro: "Ipoteze", en: "Assumptions", ru: "Допущения" })}</th></tr></thead>
              <tbody>
                <tr><td>{oc({ ro: "Pesimist", en: "Pessimistic", ru: "Пессимистичный" })}</td><td className="r">{pbTxt(eng.p.payback)} {oc({ ro: "ani", en: "yrs", ru: "лет" })}</td><td className="dim">{oc({ ro: "randament −8%, inflație 0%", en: "yield −8%, inflation 0%", ru: "выработка −8%, инфляция 0%" })}</td></tr>
                <tr className="tot"><td><b>{oc({ ro: "Așteptat", en: "Expected", ru: "Ожидаемый" })}</b></td><td className="r"><b>{pbTxt(eng.e.payback)} {oc({ ro: "ani", en: "yrs", ru: "лет" })}</b></td><td className="dim">{oc({ ro: "randament de bază, degr. 0,5%/an, inflație 3%", en: "base yield, degr. 0.5%/yr, inflation 3%", ru: "базовая выработка, деград. 0,5%/год, инфляция 3%" })}</td></tr>
                <tr><td>{oc({ ro: "Optimist", en: "Optimistic", ru: "Оптимистичный" })}</td><td className="r">{pbTxt(eng.o.payback)} {oc({ ro: "ani", en: "yrs", ru: "лет" })}</td><td className="dim">{oc({ ro: "randament +8%, inflație 5%", en: "yield +8%, inflation 5%", ru: "выработка +8%, инфляция 5%" })}</td></tr>
              </tbody>
            </table>
            <div className="doc-grid" style={{ marginTop: 8 }}>
              <div className="doc-kv"><span>{oc({ ro: `Valoare actualizată netă (VAN @ ${disc.toFixed(0)}%)`, en: `Net present value (NPV @ ${disc.toFixed(0)}%)`, ru: `NPV @ ${disc.toFixed(0)}%` })}</span><b>{eur(fin.npv)}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Rată internă de rentabilitate (RIR)", en: "Internal rate of return (IRR)", ru: "Внутренняя норма (IRR)" })}</span><b>{fin.irr == null ? "—" : (fin.irr * 100).toFixed(1) + "%"}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Cost nivelat al energiei (LCOE)", en: "Levelised cost of energy (LCOE)", ru: "LCOE" })}</span><b>€{fin.lcoe.toFixed(3)}/kWh</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Economie netă pe 25 de ani", en: "25-year net saving", ru: "Экономия за 25 лет" })}</span><b>{lei(life)}</b></div>
            </div>
            <p className="doc-note">{oc({
              ro: `LCOE de €${fin.lcoe.toFixed(3)}/kWh este sub prețul actual de rețea de €${(+client.price || 0.16).toFixed(3)}/kWh — fiecare kWh autoconsumat înlocuiește energie mai scumpă. Cifrele sunt estimări pe motorul VoltMira la ipotezele de mai sus.`,
              en: `An LCOE of €${fin.lcoe.toFixed(3)}/kWh sits below today's grid price of €${(+client.price || 0.16).toFixed(3)}/kWh — every self-consumed kWh displaces more expensive energy. Figures are VoltMira engine estimates at the assumptions above.`,
              ru: `LCOE €${fin.lcoe.toFixed(3)}/кВт·ч ниже текущей цены сети €${(+client.price || 0.16).toFixed(3)}/кВт·ч — каждый самопотреблённый кВт·ч замещает более дорогую энергию. Цифры — оценки движка VoltMira.`,
            })}</p>

            <h2>{oc({ ro: "6 · Condiții comerciale", en: "6 · Commercial terms", ru: "6 · Коммерческие условия" })}</h2>
            <h3>{oc({ ro: "Grafic de plăți", en: "Payment schedule", ru: "График платежей" })}</h3>
            <table>
              <thead><tr><th>{oc({ ro: "Etapă", en: "Milestone", ru: "Этап" })}</th><th className="r">%</th><th className="r">{oc({ ro: "Sumă (cu TVA)", en: "Amount (incl. VAT)", ru: "Сумма (с НДС)" })}</th></tr></thead>
              <tbody>
                {PAY.map(([name, pct], i) => (
                  <tr key={i}><td>{oc(name)}</td><td className="r">{(pct * 100).toFixed(0)}%</td><td className="r">{loc2(grossEur * 1.2 * pct)}</td></tr>
                ))}
              </tbody>
            </table>
            <h3>{oc({ ro: "Termen de execuție", en: "Delivery timeline", ru: "Сроки" })}</h3>
            <table>
              <thead><tr><th>{oc({ ro: "Fază", en: "Phase", ru: "Фаза" })}</th><th className="r">{oc({ ro: "Săptămâni", en: "Weeks", ru: "Недели" })}</th></tr></thead>
              <tbody>
                {TL.map(([name, wk], i) => (
                  <tr key={i}><td>{oc(name)}</td><td className="r">{wk}</td></tr>
                ))}
              </tbody>
            </table>
            <h3>{oc({ ro: "Garanții", en: "Warranties", ru: "Гарантии" })}</h3>
            <div className="doc-grid">
              <div className="doc-kv"><span>{oc({ ro: "Module — produs / performanță", en: "Modules — product / performance", ru: "Модули — продукт / выработка" })}</span><b>12 / 30 {oc({ ro: "ani", en: "yrs", ru: "лет" })}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Invertoare", en: "Inverters", ru: "Инверторы" })}</span><b>10 {oc({ ro: "ani", en: "yrs", ru: "лет" })}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Montaj (manoperă)", en: "Workmanship", ru: "Монтаж" })}</span><b>5 {oc({ ro: "ani", en: "yrs", ru: "лет" })}</b></div>
              <div className="doc-kv"><span>{oc({ ro: "Structură de montaj", en: "Mounting structure", ru: "Конструкция" })}</span><b>10 {oc({ ro: "ani", en: "yrs", ru: "лет" })}</b></div>
            </div>

            <h2>{oc({ ro: "7 · Ipoteze și mențiuni", en: "7 · Assumptions & notes", ru: "7 · Допущения и примечания" })}</h2>
            <p className="doc-note">{oc({
              ro: `Ofertă orientativă, valabilă până la ${validUntil}, sub rezerva vizitei tehnice și a expertizei de structură. Producția e estimată pe randamentul specific al sitului (PVGIS) și degradarea standard a modulelor. Prețul de rețea, cursul valutar și regimul de facturare pot varia. Racordarea depinde de avizul tehnic (ATR) al operatorului de distribuție. TVA conform legislației în vigoare.`,
              en: `Indicative offer, valid until ${validUntil}, subject to the site survey and a structural assessment. Production is estimated on the site's specific yield (PVGIS) and standard module degradation. Grid price, exchange rate and billing regime may vary. Connection depends on the distribution operator's technical approval (ATR). VAT per legislation in force.`,
              ru: `Ориентировочное предложение, действительно до ${validUntil}, при условии техобследования и оценки конструкций. Выработка оценена по удельной выработке объекта (PVGIS) и стандартной деградации. Цена сети, курс и режим биллинга могут меняться. Подключение зависит от ТУ оператора. НДС по действующему законодательству.`,
            })}</p>

            <div className="doc-sign">
              <div>{oc({ ro: "VoltMira — reprezentant (nume, semnătură, ștampilă)", en: "VoltMira — representative (name, signature, stamp)", ru: "VoltMira — представитель (имя, подпись, печать)" })}</div>
              <div>{oc({ ro: "Client — reprezentant legal (nume, semnătură, ștampilă)", en: "Client — authorised signatory (name, signature, stamp)", ru: "Клиент — уполномоченный (имя, подпись, печать)" })}</div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .qt-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px}
        @media(max-width:560px){.qt-grid{grid-template-columns:1fr}}
        .qt-grid label,.qt-toggles label{display:flex;flex-direction:column;gap:2px;font-size:12px;font-weight:600;color:var(--muted)}
        .qt-toggles{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px}
        .qt-hint{font-size:12px;color:var(--muted);line-height:1.55;margin:14px 0 12px}
        .qt-langline{font-size:12px;color:var(--ink);line-height:1.55;margin:14px 0 12px;padding:8px 11px;background:var(--green-tint);border-radius:8px}
        .qt-flag{border-radius:9px;padding:10px 13px;font-size:12.5px;font-weight:600;line-height:1.5}
        .qt-flag.ok{background:var(--green-tint);color:var(--green)}
        .qt-flag.bad{background:var(--amber-tint);color:#B4472F}
        .qt-checks{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:9px}
        .qt-checks li{display:flex;gap:9px;align-items:baseline;font-size:12.5px;color:var(--ink);line-height:1.5}
        .qt-checks li > span{flex:none;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700}
        .qt-checks li.ok > span{background:var(--green-tint);color:var(--green)}
        .qt-checks li.warn > span{background:var(--amber-tint);color:#B4472F}
        .qt-bad{color:#B4472F}
        .qt-bands{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
        .qt-band{border-radius:11px;padding:13px;background:var(--paper);border:1px solid var(--line)}
        .qt-band-t{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
        .qt-band-y{font-family:var(--font-d);font-size:21px;font-weight:700;margin-top:4px}
        .qt-band-y small{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:0}
        .qt-band.pess .qt-band-t{color:#B4472F}.qt-band.expc .qt-band-t{color:#B4700F}.qt-band.opti .qt-band-t{color:var(--green)}
        /* document-only additions (travel into the PDF: selectors carry .pv-doc) */
        .pv-doc .doc-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0 4px}
        .pv-doc .doc-metrics > div{background:#F0EEE6;border-radius:9px;padding:10px 12px}
        .pv-doc .doc-metrics b{display:block;font-size:16px;font-weight:700;color:#14211b;letter-spacing:-.01em}
        .pv-doc .doc-metrics span{font-size:9.5px;color:#666;text-transform:uppercase;letter-spacing:.04em}
        .pv-doc td.r,.pv-doc th.r{text-align:right;font-variant-numeric:tabular-nums}
        .pv-doc td.dim{color:#777;font-size:10.5px}
        .pv-doc tr.tot td{background:#EAF2ED;border-top:1px solid #CBD8CF}
        @media(max-width:560px){.pv-doc .doc-metrics{grid-template-columns:1fr 1fr}}
      ` }} />
    </>
  );
}
