"use client";
// Studio · Moldova quote.
// The quote with every Moldovan rule in it: the 10 kW residential cap, net
// metering vs net billing per client, the real Casa Verde / FEERM maths, lei
// shown first, and design sanity checks. Mock chrome; payback is the engine.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM,
  useStudioClient, ClientBar, engineSettings, DEMO_SYSTEM,
} from "../studio-kit.jsx";
import { simulate, FX } from "../_engine.js";

const TX = {
  title: { en: "Moldova quote", ro: "Ofertă Moldova", ru: "Расчёт для Молдовы" },
  sub: {
    en: "Every local rule inside the quote — the residential cap, the billing regime, the real grant maths, lei first, and the checks that stop an unbuildable design leaving as an offer.",
    ro: "Fiecare regulă locală în ofertă — plafonul rezidențial, regimul de facturare, matematica reală a grantului, lei primii, și verificările care opresc un proiect nefezabil să plece ca ofertă.",
    ru: "Каждое локальное правило внутри расчёта — лимит для жилья, режим биллинга, реальная математика гранта, лей первым, и проверки, не дающие уйти нереализуемой схеме.",
  },
  note: {
    en: "The client's language, billing regime and grant status are per-client, not one company setting. Toggle them and watch the payback, the cap and the grant respond — all on the live engine.",
    ro: "Limba clientului, regimul de facturare și statutul grantului sunt per client, nu o setare de companie. Comută-le și vezi amortizarea, plafonul și grantul reacționând — pe motorul live.",
    ru: "Язык клиента, режим биллинга и статус гранта — по клиенту, а не одна настройка компании. Переключайте и смотрите, как реагируют окупаемость, лимит и грант — на живом движке.",
  },
  clientLang: { en: "Proposal language for this client", ro: "Limba ofertei pentru acest client", ru: "Язык предложения для этого клиента" },
  segT: { en: "Client type", ro: "Tip client", ru: "Тип клиента" },
  res: { en: "Residential", ro: "Rezidențial", ru: "Жилой" },
  com: { en: "Commercial", ro: "Comercial", ru: "Коммерческий" },
  regime: { en: "Billing regime", ro: "Regim de facturare", ru: "Режим биллинга" },
  netmet: { en: "Net metering (pre-2024, 1:1)", ro: "Contorizare netă (înainte de 2024, 1:1)", ru: "Нетто-учёт (до 2024, 1:1)" },
  netbill: { en: "Net billing (2024+)", ro: "Facturare netă (2024+)", ru: "Нетто-биллинг (2024+)" },
  regimeNote: {
    en: "A prosumer connected before 2024 keeps 1:1 net metering — exports cancel imports at the retail price. Everyone since is on net billing: exports are credited at ≈ €0.07, so a battery pays off.",
    ro: "Un prosumator racordat înainte de 2024 păstrează contorizarea netă 1:1 — exportul anulează importul la prețul din factură. Toți cei de după sunt pe facturare netă: exportul se creditează la ≈ €0,07, deci bateria se amortizează.",
    ru: "Просьюмер, подключённый до 2024, сохраняет нетто-учёт 1:1 — экспорт гасит импорт по розничной цене. Все после — на нетто-биллинге: экспорт по ≈ €0,07, поэтому батарея окупается.",
  },
  capOk: { en: "Within the 10 kW residential cap", ro: "În plafonul rezidențial de 10 kW", ru: "В пределах лимита 10 кВт для жилья" },
  capBlock: {
    en: "Over the 10 kW residential cap (since June 2025). A larger system is a different connection process — split it, or quote it as commercial.",
    ro: "Peste plafonul rezidențial de 10 kW (din iunie 2025). Un sistem mai mare e alt proces de racordare — împarte-l, sau ofertează-l ca fiind comercial.",
    ru: "Свыше лимита 10 кВт для жилья (с июня 2025). Большая система — другой процесс подключения — разделите или оформляйте как коммерческий.",
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
  checks: { en: "Design checks", ro: "Verificări de proiect", ru: "Проверки схемы" },
  clip: { en: "DC / AC ratio", ro: "Raport DC / AC", ru: "Отношение DC / AC" },
  clipWarn: { en: "high — ~{p}% clipping at midday in summer", ro: "mare — ~{p}% clipping la prânz vara", ru: "высокое — ~{p}% клиппинга в полдень летом" },
  vstr: { en: "String Voc at −10 °C", ro: "Voc șir la −10 °C", ru: "Voc цепочки при −10 °C" },
  vWarn: { en: "over the inverter limit", ro: "peste limita invertorului", ru: "выше лимита инвертора" },
  battChk: { en: "Battery vs evening use", ro: "Baterie vs consum de seară", ru: "Батарея vs вечернее потребление" },
  battSmall: { en: "smaller than one evening — sized for backup, not savings", ro: "mai mică decât o seară — dimensionată pentru backup, nu economii", ru: "меньше одного вечера — для резерва, не экономии" },
  clean: { en: "all clear", ro: "totul în regulă", ru: "всё в порядке" },
  offer: { en: "The offer, in lei", ro: "Oferta, în lei", ru: "Предложение, в леях" },
  system: { en: "System", ro: "Sistem", ru: "Система" },
  turnkey: { en: "Turnkey", ro: "La cheie", ru: "Под ключ" },
  afterGrant: { en: "After grant", ro: "După grant", ru: "После гранта" },
  pb: { en: "Payback", ro: "Amortizare", ru: "Окупаемость" },
  yrs: { en: "yrs", ro: "ani", ru: "лет" },
  save25: { en: "25-year saving", ro: "Economie pe 25 de ani", ru: "Экономия за 25 лет" },
  pess: { en: "Pessimistic", ro: "Pesimist", ru: "Пессим." },
  expc: { en: "Expected", ro: "Așteptat", ru: "Ожид." },
  opti: { en: "Optimistic", ro: "Optimist", ru: "Оптим." },
};

const LANG_NAME = {
  ro: { ro: "română", en: "Romanian", ru: "румынском" },
  ru: { ro: "rusă", en: "Russian", ru: "русском" },
  en: { ro: "engleză", en: "English", ru: "английском" },
};

export default function QuotePreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Moldova quote — VoltMira Studio"; }, []);

  const [clientLang, setClientLang] = useState("ro");
  const [seg, setSeg] = useState("res");
  const [regime, setRegime] = useState("netbill");
  const [env, setEnv] = useState({ insul: true, windows: false });

  const kw = +client.kw || 0;
  const capExceeded = seg === "res" && client.market === "MD" && kw > 10;

  const eng = useMemo(() => {
    const E = engineSettings();
    // legacy net metering ≈ RO 1:1 rules with the MD retail price; net billing = MD.
    const mkt = regime === "netmet" ? "RO" : "MD";
    const base = {
      market: mkt, kw, price: +client.price || 0.185, cons: +client.cons || 0,
      batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0, yieldOverride: 1235,
    };
    const q = {
      p: simulate(base, E, "pess"), e: simulate(base, E, "expc"), o: simulate(base, E, "opti"),
    };
    return { q, grossEur: q.e.grossCost };
  }, [client, regime, kw]);

  const grant = useMemo(() => {
    const eligible = env.insul && env.windows;
    const capexMdl = eng.grossEur * FX.MDL;
    const amt = Math.min(200000, Math.round((capexMdl * 0.5) / 1000) * 1000);
    return { eligible, amtMdl: eligible ? amt : 0, amtEur: eligible ? amt / FX.MDL : 0 };
  }, [env, eng]);

  // design checks
  const panel = DEMO_SYSTEM.panel;
  const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
  const dcKw = (modules * panel.watt) / 1000;
  const invKw = Math.max(3, Math.round((dcKw / 1.15) / 0.5) * 0.5);
  const dcac = dcKw / invKw;
  const clipPct = dcac > 1.3 ? Math.round((dcac - 1.15) * 22) : 0;
  const strings = dcKw > 5.2 ? Math.max(2, Math.ceil(dcKw / 5.5)) : 1;
  const vCold = Math.ceil(modules / strings) * panel.voc * 1.11;
  const invMaxV = client.phases === 3 ? 800 : 500;
  const vWarn = vCold > invMaxV;
  const battKwh = +client.batteryKwh || 0;
  const eveningKwh = ((+client.cons || 0) / 365) * 0.5;
  const battSmall = battKwh > 0 && battKwh < eveningKwh * 0.7;

  const lei = (eur) => NUM(eur * FX.MDL) + " lei";
  const eur = (e) => "€" + NUM(e);
  const netEur = Math.max(0, eng.grossEur - grant.amtEur);
  const pbTxt = (v) => (v == null ? "25+" : v.toFixed(1));
  const life = eng.q.e.rows.length ? eng.q.e.rows[eng.q.e.rows.length - 1] + eng.q.e.cost : 0;

  return (
    <>
      <PreviewHeader slug="quote" lang={lang} title={T(TX.title)} sub={T(TX.sub)} />
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
          <label>{T(TX.segT)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              <button className={seg === "res" ? "on" : ""} onClick={() => setSeg("res")}>{T(TX.res)}</button>
              <button className={seg === "com" ? "on" : ""} onClick={() => setSeg("com")}>{T(TX.com)}</button>
            </div>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>{T(TX.regime)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              <button className={regime === "netbill" ? "on" : ""} onClick={() => setRegime("netbill")}>{T(TX.netbill)}</button>
              <button className={regime === "netmet" ? "on" : ""} onClick={() => setRegime("netmet")}>{T(TX.netmet)}</button>
            </div>
          </label>
        </div>
        <p className="qt-hint">{T(TX.regimeNote)}</p>
        <p className="qt-langline">{tx({
          ro: `Oferta, contractul și dosarul de racordare pentru acest client se generează în ${LANG_NAME[clientLang].ro}` + (clientLang !== lang ? ` — independent de limba în care lucrezi tu acum.` : `.`),
          en: `This client's proposal, contract and connection file are generated in ${LANG_NAME[clientLang].en}` + (clientLang !== lang ? ` — independent of the language you're working in.` : `.`),
          ru: `Предложение, договор и пакет на подключение этого клиента формируются на ${LANG_NAME[clientLang].ru}` + (clientLang !== lang ? ` — независимо от языка, на котором работаете вы.` : `.`),
        }, lang)}</p>
        <div className={"qt-flag " + (capExceeded ? "bad" : "ok")}>
          {seg === "com"
            ? tx({ ro: "Client comercial — fără plafon rezidențial; se aplică procesul de racordare C&I și e-Factura SFS.", en: "Commercial client — no residential cap; the C&I connection process and SFS e-Factura apply.", ru: "Коммерческий клиент — без лимита для жилья; применяется процесс подключения C&I и e-Factura SFS." }, lang)
            : capExceeded ? T(TX.capBlock) : T(TX.capOk)} · {kw.toFixed(1)} kW
        </div>
      </div>

      {/* FEERM */}
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

      {/* design checks */}
      <div className="pv-panel">
        <h3>{T(TX.checks)}</h3>
        <ul className="qt-checks">
          <li className={clipPct > 8 ? "warn" : "ok"}>
            <span>{clipPct > 8 ? "!" : "✓"}</span>{T(TX.clip)}: <b>{dcac.toFixed(2)}</b>
            {clipPct > 8 ? " — " + tx({ ...TX.clipWarn }, lang).replace("{p}", clipPct) : ""}
          </li>
          <li className={vWarn ? "warn" : "ok"}>
            <span>{vWarn ? "!" : "✓"}</span>{T(TX.vstr)}: <b className={vWarn ? "qt-bad" : ""}>{vCold.toFixed(0)} V</b> / {invMaxV} V{vWarn ? " — " + T(TX.vWarn) : ""}
          </li>
          <li className={battSmall ? "warn" : "ok"}>
            <span>{battSmall ? "!" : "✓"}</span>{T(TX.battChk)}: <b>{battKwh || "—"} kWh</b> / {eveningKwh.toFixed(1)} kWh{battSmall ? " — " + T(TX.battSmall) : ""}
          </li>
        </ul>
        {clipPct <= 8 && !vWarn && !battSmall && <div className="qt-flag ok">{T(TX.clean)}</div>}
      </div>

      {/* offer in lei */}
      <div className="pv-panel">
        <h3>{T(TX.offer)}</h3>
        <div className="pv-metrics">
          <div className="pv-metric"><b>{kw.toFixed(1)} kW{battKwh > 0 ? ` · ${battKwh} kWh` : ""}</b><span>{T(TX.system)}</span></div>
          <div className="pv-metric"><b>{lei(eng.grossEur)}</b><span>{T(TX.turnkey)} · {eur(eng.grossEur)}</span></div>
          {grant.eligible && <div className="pv-metric good"><b>{lei(netEur)}</b><span>{T(TX.afterGrant)} · {eur(netEur)}</span></div>}
          <div className="pv-metric"><b>{lei(life)}</b><span>{T(TX.save25)}</span></div>
        </div>
        <div className="qt-bands">
          {[["pess", TX.pess, eng.q.p], ["expc", TX.expc, eng.q.e], ["opti", TX.opti, eng.q.o]].map(([k, lbl, b]) => (
            <div key={k} className={"qt-band " + k}>
              <div className="qt-band-t">{tx(lbl, lang)}</div>
              <div className="qt-band-y">{pbTxt(b.payback)} <small>{T(TX.yrs)}</small></div>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .qt-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px}
        @media(max-width:560px){.qt-grid{grid-template-columns:1fr}}
        .qt-grid label,.qt-toggles label{display:flex;flex-direction:column;gap:2px;font-size:12px;font-weight:600;color:var(--muted)}
        .qt-toggles{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px}
        .qt-hint{font-size:12px;color:var(--muted);line-height:1.55;margin:14px 0 12px}
        .qt-langline{font-size:12px;color:var(--ink);line-height:1.55;margin:0 0 12px;padding:8px 11px;background:var(--green-tint);border-radius:8px}
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
        .qt-band.pess .qt-band-t{color:#B4472F}.qt-band.expc .qt-band-t{color:#B4700F}.qt-band.opti .qt-band-t{color:var(--green)}
      ` }} />
    </>
  );
}
