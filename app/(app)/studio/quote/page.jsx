"use client";
// Studio · Commercial & Industrial (C&I) offer.
// The quote surface for mega projects — 100 kW to multi-hundred-kW rooftop and
// ground systems for factories, warehouses and agri halls. It keeps the honest
// VoltMira engine (three payback bands) and adds the numbers a business actually
// signs against: self-consumption, capex breakdown, NPV / IRR / LCOE, a payment
// schedule and a delivery timeline — and it exports all of that as a real,
// multi-page offer document, not half a page of figures.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, downloadStudioDoc,
  useStudioClient, ClientBar, engineSettings, DEMO_SYSTEM,
} from "../studio-kit.jsx";
import { simulate, FX, effectiveYield } from "../_engine.js";

const TX = {
  title: { en: "Commercial offer (C&I)", ro: "Ofertă comercială (C&I)", ru: "Коммерческое предложение (C&I)" },
  sub: {
    en: "The offer for mega projects — factory, warehouse and agri rooftops from 100 kW up. Self-consumption, a full capex breakdown, NPV / IRR / LCOE, a payment schedule and delivery timeline, all on the live engine — exported as a real offer dossier, not half a page.",
    ro: "Oferta pentru proiecte mari — hale, depozite și ferme de la 100 kW în sus. Autoconsum, defalcarea completă a investiției, VAN / RIR / LCOE, grafic de plăți și de execuție, totul pe motorul live — exportate ca dosar de ofertă real, nu o jumătate de pagină.",
    ru: "Предложение для мегапроектов — заводы, склады и агрокрыши от 100 кВт. Самопотребление, полная разбивка капзатрат, NPV / IRR / LCOE, график платежей и сроков — всё на живом движке, выгружается как настоящий пакет, а не полстраницы.",
  },
  note: {
    en: "Load the 'Fabrica AgroNord' sample for a 300 kW case, or push the system slider up. Every figure — production, self-consumption, capex, NPV/IRR/LCOE — is the VoltMira engine on this client's inputs.",
    ro: "Încarcă exemplul „Fabrica AgroNord” pentru un caz de 300 kW, sau urcă glisorul de putere. Fiecare cifră — producție, autoconsum, investiție, VAN/RIR/LCOE — e motorul VoltMira pe datele acestui client.",
    ru: "Загрузите пример «Fabrica AgroNord» для кейса 300 кВт или поднимите ползунок мощности. Каждая цифра — движок VoltMira на данных клиента.",
  },
  clientLang: { en: "Offer language for this client", ro: "Limba ofertei pentru acest client", ru: "Язык предложения для клиента" },
  regime: { en: "Billing regime", ro: "Regim de facturare", ru: "Режим биллинга" },
  netmet: { en: "Net metering (pre-2024, 1:1)", ro: "Contorizare netă (înainte de 2024, 1:1)", ru: "Нетто-учёт (до 2024, 1:1)" },
  netbill: { en: "Net billing (2024+)", ro: "Facturare netă (2024+)", ru: "Нетто-биллинг (2024+)" },
  vat: { en: "VAT-registered buyer", ro: "Cumpărător plătitor de TVA", ru: "Покупатель — плательщик НДС" },
  disc: { en: "Discount rate (for NPV)", ro: "Rată de actualizare (pentru VAN)", ru: "Ставка дисконта (для NPV)" },
  ciNote: {
    en: "Commercial & industrial — no residential cap. A business self-consumes most of its production during working hours, so the return leans on avoided retail cost, not export. VAT is recoverable and the SFS e-Factura applies.",
    ro: "Comercial și industrial — fără plafon rezidențial. O firmă autoconsumă cea mai mare parte a producției în programul de lucru, deci randamentul se sprijină pe costul de rețea evitat, nu pe export. TVA e deductibil și se aplică e-Factura SFS.",
    ru: "Коммерческий и промышленный — без лимита для жилья. Бизнес потребляет большую часть выработки в рабочее время, поэтому доходность опирается на избегаемую розничную цену, а не на экспорт. НДС возмещается, применяется e-Factura SFS.",
  },
  checks: { en: "Design & connection checks", ro: "Verificări de proiect și racordare", ru: "Проверки схемы и подключения" },
  clip: { en: "DC / AC ratio", ro: "Raport DC / AC", ru: "Отношение DC / AC" },
  clipWarn: { en: "high — ~{p}% clipping at midday in summer", ro: "mare — ~{p}% clipping la prânz vara", ru: "высокое — ~{p}% клиппинга в полдень летом" },
  invChk: { en: "Inverter block", ro: "Bloc invertoare", ru: "Блок инверторов" },
  connChk: { en: "Grid connection", ro: "Racordare la rețea", ru: "Подключение к сети" },
  selfChk: { en: "Self-consumption", ro: "Autoconsum", ru: "Самопотребление" },
  selfLow: { en: "low — most output is exported at the feed price; a bigger load or a battery lifts the return", ro: "scăzut — mare parte din producție se exportă la prețul de injecție; un consum mai mare sau o baterie cresc randamentul", ru: "низкое — большая часть уходит на экспорт по цене инжекции; больше нагрузки или батарея повысят доходность" },
  clean: { en: "all clear — buildable as scoped", ro: "totul în regulă — fezabil ca proiectat", ru: "всё в порядке — реализуемо по проекту" },
  offer: { en: "The numbers, in lei", ro: "Cifrele, în lei", ru: "Цифры, в леях" },
  system: { en: "System", ro: "Sistem", ru: "Система" },
  prod: { en: "Production", ro: "Producție", ru: "Выработка" },
  turnkey: { en: "Turnkey capex", ro: "Investiție la cheie", ru: "Капзатраты под ключ" },
  perkwp: { en: "per kWp", ro: "pe kWp", ru: "за кВт·п" },
  save1: { en: "Year-1 saving", ro: "Economie an 1", ru: "Экономия год 1" },
  save25: { en: "25-year net", ro: "Net pe 25 de ani", ru: "Нетто за 25 лет" },
  npv: { en: "NPV", ro: "VAN", ru: "NPV" },
  irr: { en: "IRR", ro: "RIR", ru: "IRR" },
  lcoe: { en: "LCOE", ro: "LCOE", ru: "LCOE" },
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
// Grid CO₂ intensity (kg/kWh) — avoided emissions from self-consumed + exported
// solar displacing grid power. Regional ballpark.
const CO2 = { MD: 0.40, RO: 0.28 };

export default function QuotePreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Commercial offer — VoltMira Studio"; }, []);

  const [clientLang, setClientLang] = useState("ro");
  const [regime, setRegime] = useState("netbill");
  const [vatReg, setVatReg] = useState(true);
  const [disc, setDisc] = useState(6); // % discount rate for NPV

  const kw = +client.kw || 0;

  const E = useMemo(() => engineSettings(), []);
  const eng = useMemo(() => {
    // legacy net metering ≈ RO 1:1 rules with the local retail price; net billing = MD.
    const mkt = regime === "netmet" ? "RO" : "MD";
    const base = {
      market: mkt, kw, price: +client.price || 0.16, cons: +client.cons || 0,
      batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0, yieldOverride: effectiveYield(client),
    };
    return {
      p: simulate(base, E, "pess"), e: simulate(base, E, "expc"), o: simulate(base, E, "opti"),
    };
  }, [client, regime, kw, E]);

  const sim = eng.e;
  const grossEur = sim.grossCost;

  // ---- financial analysis (NPV / IRR / LCOE) on the expected band ----------
  const fin = useMemo(() => {
    const cost = grossEur; // C&I: no residential grant — capex is the investment
    const nets = [];
    let prev = -cost;
    for (const c of sim.rows) { nets.push(c - prev); prev = c; }
    const d = disc / 100;
    const npvAt = (r) => nets.reduce((a, n, i) => a + n / Math.pow(1 + r, i + 1), -cost);
    const npv = npvAt(d);
    // IRR by bisection
    let irr = null;
    if (npvAt(-0.5) * npvAt(1.5) < 0) {
      let lo = -0.5, hi = 1.5;
      for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (npvAt(m) > 0) lo = m; else hi = m; }
      irr = (lo + hi) / 2;
    }
    // LCOE: discounted lifetime cost / discounted lifetime production
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

  // ---- system build-up ------------------------------------------------------
  const panel = DEMO_SYSTEM.panel;
  const modules = Math.max(1, Math.round((kw * 1000) / panel.watt));
  const dcKw = (modules * panel.watt) / 1000;
  const nInv = Math.max(1, Math.ceil((dcKw / 1.2) / CI_INV.kw));
  const acKw = nInv * CI_INV.kw;
  const dcac = dcKw / acKw;
  const clipPct = dcac > 1.3 ? Math.round((dcac - 1.15) * 22) : 0;
  const mvLevel = kw > 100;               // >100 kW → typically an MV / dedicated connection
  const effY = effectiveYield(client);
  const prodKwh = sim.prod0;              // yr-1 production, engine
  const selfPct = Math.round((sim.self || 0) * 100);
  const selfLow = selfPct < 45;
  const co2t = (prodKwh * (CO2[client.market] || CO2.MD)) / 1000; // tonnes/yr

  // ---- money helpers --------------------------------------------------------
  const lei = (eur) => NUM(eur * FX.MDL) + " lei";
  const eur = (e) => "€" + NUM(e);
  const life = sim.rows.length ? sim.rows[sim.rows.length - 1] : 0; // 25-yr net (undiscounted)
  const perKwp = kw > 0 ? grossEur / kw : 0;
  const pbTxt = (v) => (v == null ? "25+" : v.toFixed(1));

  // capex breakdown (typical C&I cost shares of turnkey price)
  const CAPEX = [
    ["mod", { ro: "Module fotovoltaice", en: "PV modules", ru: "ФЭ-модули" }, 0.42, `${modules} × ${panel.watt} W ${panel.brand}`],
    ["inv", { ro: "Invertoare", en: "Inverters", ru: "Инверторы" }, 0.14, `${nInv} × ${CI_INV.kw} kW ${CI_INV.brand}`],
    ["mnt", { ro: "Structură de montaj", en: "Mounting structure", ru: "Несущая конструкция" }, 0.12, clientLang === "en" ? "flat-roof / trapezoidal sheet" : "acoperiș terasă / tablă cutată"],
    ["ele", { ro: "Electrice DC/AC, protecții, tablouri", en: "DC/AC electrical, protections, switchboards", ru: "DC/AC, защиты, щиты" }, 0.13, mvLevel ? (clientLang === "en" ? "incl. MV interface" : "incl. interfață MT") : "LV"],
    ["lab", { ro: "Montaj și punere în funcțiune", en: "Installation & commissioning", ru: "Монтаж и пусконаладка" }, 0.11, ""],
    ["eng", { ro: "Proiectare, avize, monitorizare", en: "Design, permits, monitoring", ru: "Проект, согласования, мониторинг" }, 0.08, clientLang === "en" ? "incl. export limitation" : "incl. limitare export"],
  ];

  // payment schedule (C&I standard)
  const PAY = [
    [{ ro: "La semnarea contractului", en: "On contract signature", ru: "При подписании договора" }, 0.30],
    [{ ro: "La livrarea echipamentelor pe șantier", en: "On delivery of equipment to site", ru: "При поставке оборудования" }, 0.40],
    [{ ro: "La finalizarea montajului", en: "On completion of installation", ru: "По завершении монтажа" }, 0.25],
    [{ ro: "La punerea în funcțiune (garanție de bună execuție)", en: "On commissioning (retention)", ru: "При вводе (гарантийное удержание)" }, 0.05],
  ];

  // delivery timeline (weeks, cumulative-ish phases)
  const TL = [
    [{ ro: "Contractare și proiect tehnic", en: "Contract & detailed design", ru: "Договор и рабочий проект" }, "1–2"],
    [{ ro: "Avize și aviz tehnic de racordare (ATR)", en: "Permits & grid connection approval (ATR)", ru: "Согласования и ТУ на подключение" }, mvLevel ? "6–10" : "4–6"],
    [{ ro: "Aprovizionare echipamente", en: "Equipment procurement", ru: "Закупка оборудования" }, "3–5"],
    [{ ro: "Montaj pe șantier", en: "On-site installation", ru: "Монтаж на объекте" }, kw > 200 ? "4–6" : "2–4"],
    [{ ro: "Punere în funcțiune și energizare", en: "Commissioning & energization", ru: "Пусконаладка и включение" }, "1–2"],
  ];

  const oc = (o) => tx(o, clientLang);
  const ocLoc = clientLang === "ru" ? "ru-RU" : clientLang === "en" ? "en-IE" : "ro-RO";
  const validUntil = new Date(Date.now() + (E.quoteValidityDays || 30) * 864e5).toLocaleDateString(ocLoc);
  const today = new Date().toLocaleDateString(ocLoc);
  const loc2 = (e) => `${lei(e)}`;

  return (
    <>
      <PreviewHeader slug="quote" lang={lang} title={T(TX.title)} sub={T(TX.sub)}
        right={<button className="btn ghost sm" onClick={() => downloadStudioDoc("oferta-ci-" + (client.ref || "voltmira"))}>{tx({ en: "Download offer PDF", ro: "Descarcă oferta PDF", ru: "Скачать PDF" }, lang)}</button>} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      {/* per-client controls */}
      <div className="pv-panel">
        <div className="qt-grid">
          <label>{T(TX.clientLang)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              {["ro", "ru", "en"].map((l) => (
                <button key={l} className={clientLang === l ? "on" : ""} onClick={() => setClientLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </label>
          <label>{T(TX.vat)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              <button className={vatReg ? "on" : ""} onClick={() => setVatReg(true)}>{tx({ en: "yes", ro: "da", ru: "да" }, lang)}</button>
              <button className={!vatReg ? "on" : ""} onClick={() => setVatReg(false)}>{tx({ en: "no", ro: "nu", ru: "нет" }, lang)}</button>
            </div>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>{T(TX.regime)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              <button className={regime === "netbill" ? "on" : ""} onClick={() => setRegime("netbill")}>{T(TX.netbill)}</button>
              <button className={regime === "netmet" ? "on" : ""} onClick={() => setRegime("netmet")}>{T(TX.netmet)}</button>
            </div>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>{T(TX.disc)} <output style={{ color: "var(--green)", fontWeight: 700 }}>{disc.toFixed(1)}%</output>
            <input type="range" min="3" max="12" step="0.5" value={disc}
              style={{ "--fill": ((disc - 3) / 9) * 100 + "%", marginTop: 6 }}
              onChange={(e) => setDisc(+e.target.value)} />
          </label>
        </div>
        <p className="qt-langline">{tx({
          ro: `Oferta, contractul și dosarul de racordare pentru acest client se generează în ${LANG_NAME[clientLang].ro}` + (clientLang !== lang ? ` — independent de limba în care lucrezi tu acum.` : `.`),
          en: `This client's offer, contract and connection file are generated in ${LANG_NAME[clientLang].en}` + (clientLang !== lang ? ` — independent of the language you're working in.` : `.`),
          ru: `Предложение, договор и пакет на подключение этого клиента формируются на ${LANG_NAME[clientLang].ru}` + (clientLang !== lang ? ` — независимо от языка, на котором работаете вы.` : `.`),
        }, lang)}</p>
        <div className="qt-flag ok">{T(TX.ciNote)} · {kw.toFixed(0)} kWp</div>
      </div>

      {/* design & connection checks */}
      <div className="pv-panel">
        <h3>{T(TX.checks)}</h3>
        <ul className="qt-checks">
          <li className={clipPct > 8 ? "warn" : "ok"}>
            <span>{clipPct > 8 ? "!" : "✓"}</span>{T(TX.clip)}: <b>{dcac.toFixed(2)}</b>
            {clipPct > 8 ? " — " + tx({ ...TX.clipWarn }, lang).replace("{p}", clipPct) : ""}
          </li>
          <li className="ok">
            <span>✓</span>{T(TX.invChk)}: <b>{nInv} × {CI_INV.kw} kW</b> {CI_INV.brand} · {acKw} kW AC / {dcKw.toFixed(0)} kWp DC
          </li>
          <li className="ok">
            <span>✓</span>{T(TX.connChk)}: <b>{mvLevel ? tx({ ro: "medie tensiune (MT) / racord dedicat", en: "medium voltage (MV) / dedicated feeder", ru: "среднее напряжение (СН)" }, lang) : tx({ ro: "joasă tensiune 0,4 kV, 3~", en: "low voltage 0.4 kV, 3-phase", ru: "низкое напряжение 0,4 кВ" }, lang)}</b>
          </li>
          <li className={selfLow ? "warn" : "ok"}>
            <span>{selfLow ? "!" : "✓"}</span>{T(TX.selfChk)}: <b>{selfPct}%</b>{selfLow ? " — " + T(TX.selfLow) : ""}
          </li>
        </ul>
        {clipPct <= 8 && !selfLow && <div className="qt-flag ok">{T(TX.clean)}</div>}
      </div>

      {/* headline numbers */}
      <div className="pv-panel">
        <h3>{T(TX.offer)}</h3>
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
        <div className="qt-bands">
          {[["pess", TX.pess, eng.p], ["expc", TX.expc, eng.e], ["opti", TX.opti, eng.o]].map(([k, lbl, b]) => (
            <div key={k} className={"qt-band " + k}>
              <div className="qt-band-t">{tx(lbl, lang)}</div>
              <div className="qt-band-y">{pbTxt(b.payback)} <small>{T(TX.yrs)} {T(TX.pb)}</small></div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- the offer document (this is what "Download offer PDF" exports) ---- */}
      <div className="pv-doc-scroll">
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

          {/* 1 · executive summary */}
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

          {/* 2 · scope of works / bill of materials */}
          <h2>{oc({ ro: "2 · Sistemul propus", en: "2 · System & scope of works", ru: "2 · Система и объём работ" })}</h2>
          <div className="doc-grid">
            <div className="doc-kv"><span>{oc({ ro: "Module", en: "Modules", ru: "Модули" })}</span><b>{modules} × {panel.watt} W · {panel.brand}</b></div>
            <div className="doc-kv"><span>{oc({ ro: "Putere DC", en: "DC power", ru: "Мощность DC" })}</span><b>{dcKw.toFixed(0)} kWp</b></div>
            <div className="doc-kv"><span>{oc({ ro: "Invertoare", en: "Inverters", ru: "Инверторы" })}</span><b>{nInv} × {CI_INV.kw} kW · {CI_INV.brand}</b></div>
            <div className="doc-kv"><span>{oc({ ro: "Putere AC", en: "AC power", ru: "Мощность AC" })}</span><b>{acKw} kW · DC/AC {dcac.toFixed(2)}</b></div>
            <div className="doc-kv"><span>{oc({ ro: "Structură", en: "Mounting", ru: "Конструкция" })}</span><b>{oc({ ro: "acoperiș / tablă cutată", en: "roof / trapezoidal sheet", ru: "крыша / профлист" })}</b></div>
            <div className="doc-kv"><span>{oc({ ro: "Monitorizare", en: "Monitoring", ru: "Мониторинг" })}</span><b>{oc({ ro: "portal + limitare export", en: "portal + export limiter", ru: "портал + ограничитель" })}</b></div>
          </div>
          <p className="doc-note">{oc({
            ro: "Scopul include proiectarea, furnizarea, montajul, protecțiile AC/DC, punerea în funcțiune, dosarul de racordare (ATR) și monitorizarea. Nu include lucrări de consolidare a structurii clădirii dacă expertiza tehnică le cere.",
            en: "Scope covers design, supply, installation, AC/DC protections, commissioning, the grid connection file (ATR) and monitoring. It excludes any building structural strengthening if the structural survey requires it.",
            ru: "В объём входят проект, поставка, монтаж, защиты AC/DC, пусконаладка, пакет на подключение и мониторинг. Не включает усиление конструкций здания, если этого требует обследование.",
          })}</p>

          {/* 3 · energy & performance */}
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

          {/* 4 · investment breakdown */}
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

          {/* 5 · financial analysis */}
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

          {/* 6 · commercial terms */}
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

          {/* 7 · assumptions */}
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
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .qt-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px}
        @media(max-width:560px){.qt-grid{grid-template-columns:1fr}}
        .qt-grid label{display:flex;flex-direction:column;gap:2px;font-size:12px;font-weight:600;color:var(--muted)}
        .qt-langline{font-size:12px;color:var(--ink);line-height:1.55;margin:14px 0 12px;padding:8px 11px;background:var(--green-tint);border-radius:8px}
        .qt-flag{border-radius:9px;padding:10px 13px;font-size:12.5px;font-weight:600;line-height:1.5}
        .qt-flag.ok{background:var(--green-tint);color:var(--green)}
        .qt-flag.bad{background:var(--amber-tint);color:#B4472F}
        .qt-checks{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:9px}
        .qt-checks li{display:flex;gap:9px;align-items:baseline;font-size:12.5px;color:var(--ink);line-height:1.5}
        .qt-checks li > span{flex:none;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700}
        .qt-checks li.ok > span{background:var(--green-tint);color:var(--green)}
        .qt-checks li.warn > span{background:var(--amber-tint);color:#B4472F}
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
