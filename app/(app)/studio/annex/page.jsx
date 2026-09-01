"use client";
// Preview 2 — Templated technical annex.
// Auto-fills a single-line diagram + equipment schedule + protection settings for
// an ANRE / distribution-operator prosumer filing. Not CAD-grade — it exists,
// it's consistent, and it prints.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, makeT, PreviewHeader, MockNote, DEMO_SYSTEM, protRows,
  useStudioClient, ClientBar,
} from "../studio-kit.jsx";

const TX = {
  title: { en: "Technical annex", ro: "Anexă tehnică", ru: "Техническое приложение" },
  sub: {
    en: "Single-line diagram, equipment schedule and protection settings, filled from the quote. Ready to attach to a prosumer connection request.",
    ro: "Schemă monofilară, borderou de echipamente și reglaje de protecții, completate din ofertă. Gata de atașat la cererea de racordare a prosumatorului.",
    ru: "Однолинейная схема, спецификация оборудования и уставки защит, заполненные из расчёта.",
  },
  filing: { en: "Filing target", ro: "Destinatar dosar", ru: "Куда подаётся" },
  docLang: { en: "Document language", ro: "Limba documentului", ru: "Язык документа" },
  phases: { en: "Connection", ro: "Racordare", ru: "Подключение" },
  ph1: { en: "Single-phase", ro: "Monofazat", ru: "Однофазное" },
  ph3: { en: "Three-phase", ro: "Trifazat", ru: "Трёхфазное" },
  size: { en: "PV size", ro: "Putere PV", ru: "Мощность PV" },
  battery: { en: "Battery", ro: "Baterie", ru: "Батарея" },
  print: { en: "Print / PDF", ro: "Printează / PDF", ru: "Печать / PDF" },
  note: {
    en: "Every value below is derived from the quote inputs and the equipment catalog — module count, string voltage, breaker sizing, cable cross-sections. An engineer reviews and stamps it; the annex removes the blank-page hour.",
    ro: "Fiecare valoare de mai jos rezultă din datele ofertei și catalogul de echipamente — număr module, tensiune șir, dimensionare disjunctor, secțiuni cablu. Un inginer o verifică și o ștampilează.",
    ru: "Каждое значение ниже выводится из данных расчёта и каталога оборудования. Инженер проверяет и заверяет.",
  },
};

// Document strings (RO / EN only — these filings are never in Russian).
const D = {
  h_annex: { ro: "ANEXĂ TEHNICĂ — Instalație de producere a energiei electrice (prosumator)", en: "TECHNICAL ANNEX — Electricity generating installation (prosumer)" },
  to: { ro: "Către", en: "To" },
  ident: { ro: "1. Date de identificare", en: "1. Identification" },
  beneficiary: { ro: "Beneficiar / Prosumator", en: "Beneficiary / Prosumer" },
  address: { ro: "Adresa locului de consum", en: "Consumption site address" },
  contract: { ro: "Nr. contract furnizare", en: "Supply contract no." },
  pod: { ro: "Punct de delimitare (POD)", en: "Point of delimitation" },
  approved: { ro: "Putere aprobată consum", en: "Approved consumption power" },
  regime: { ro: "Regim de funcționare", en: "Operating regime" },
  regime_v: { ro: "Prosumator — schema de compensare cantitativă/valorică", en: "Prosumer — net billing / net metering scheme" },
  installer: { ro: "Instalator autorizat", en: "Authorised installer" },
  atestat: { ro: "Atestat ANRE / licență", en: "ANRE attestation / licence" },
  sys: { ro: "2. Caracteristici instalație fotovoltaică", en: "2. PV installation characteristics" },
  pdc: { ro: "Putere instalată DC (module)", en: "Installed DC power (modules)" },
  pac: { ro: "Putere maximă evacuată AC", en: "Maximum AC export power" },
  modules: { ro: "Module fotovoltaice", en: "PV modules" },
  strings: { ro: "Configurație șiruri", en: "String configuration" },
  voc: { ro: "Tensiune șir Voc (−10 °C)", en: "String voltage Voc (−10 °C)" },
  isc: { ro: "Curent scurtcircuit șir Isc", en: "String short-circuit current Isc" },
  inverter: { ro: "Invertor", en: "Inverter" },
  storage: { ro: "Stocare (baterie)", en: "Storage (battery)" },
  sld: { ro: "3. Schemă electrică monofilară", en: "3. Single-line diagram" },
  sched: { ro: "4. Borderou de echipamente", en: "4. Equipment schedule" },
  c_item: { ro: "Poz.", en: "Item" }, c_desc: { ro: "Denumire / caracteristici", en: "Description / rating" },
  c_qty: { ro: "Cant.", en: "Qty" }, c_std: { ro: "Standard de referință", en: "Reference standard" },
  prot: { ro: "5. Reglaje protecții interfață (SR EN 50549-1)", en: "5. Interface protection settings (SR EN 50549-1)" },
  p_fn: { ro: "Funcție", en: "Function" }, p_set: { ro: "Prag", en: "Setting" }, p_t: { ro: "Temporizare", en: "Trip time" },
  cables: { ro: "6. Cabluri și legare la pământ", en: "6. Cabling and earthing" },
  decl: { ro: "7. Declarație", en: "7. Declaration" },
  decl_v: {
    ro: "Instalația a fost proiectată și va fi executată conform SR HD 60364-7-712, SR EN 50549-1 și normativelor tehnice în vigoare. Invertorul deține certificat de conformitate cu codul de rețea și funcție anti-insularizare (LoM). Instalația nu debitează în rețea în absența tensiunii din rețea.",
    en: "The installation is designed and will be executed to SR HD 60364-7-712, SR EN 50549-1 and applicable technical norms. The inverter holds a grid-code conformity certificate and loss-of-mains (anti-islanding) protection. The installation does not feed the grid in the absence of grid voltage.",
  },
  sign_inst: { ro: "Instalator autorizat (nume, semnătură, ștampilă)", en: "Authorised installer (name, signature, stamp)" },
  sign_ben: { ro: "Beneficiar (nume, semnătură)", en: "Beneficiary (name, signature)" },
  gen: { ro: "Generat de VoltMira · verificați cu proiectantul", en: "Generated by VoltMira · verify with your design engineer" },
  date: { ro: "Data", en: "Date" },
};

const FILINGS = {
  MD: [
    { id: "premier", label: "Premier Energy Distribution SA" },
    { id: "rednord", label: "ÎCS RED Nord SA" },
    { id: "moldelectrica", label: "ÎS Moldelectrica (OST)" },
  ],
  RO: [
    { id: "anre", label: "ANRE — Autoritatea Națională de Reglementare în Energie" },
    { id: "deer", label: "Distribuție Energie Electrică România (DEER)" },
    { id: "edistributie", label: "E-Distribuție Muntenia SA" },
    { id: "delgaz", label: "Delgaz Grid SA" },
  ],
};

function nextStd(v, list) { return list.find((x) => x >= v) || list[list.length - 1]; }

export default function AnnexPreview() {
  const lang = useLang();
  const t = makeT(TX, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Technical annex — VoltMira Studio"; }, []);

  const market = client.market, phases = client.phases;
  const kw = +client.kw || 0;
  const battKwh = +client.batteryKwh || 0;
  const batt = battKwh > 0;
  const approvedKw = Math.max(Math.ceil(kw), phases === 3 ? 12 : 8);

  const [docLang, setDocLang] = useState(lang === "en" ? "en" : "ro");
  const [filing, setFiling] = useState(FILINGS[client.market][0].id);
  useEffect(() => { setDocLang(lang === "en" ? "en" : "ro"); }, [lang]);
  useEffect(() => { setFiling(FILINGS[market][0].id); }, [market]);
  const d = (k) => D[k]?.[docLang] || D[k]?.ro || k;

  const eng = useMemo(() => {
    const panel = DEMO_SYSTEM.panel;
    const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
    const dcKw = (modules * panel.watt) / 1000;
    const strings = dcKw > 5.2 ? Math.max(2, Math.ceil(dcKw / 5.5)) : 1;
    const perString = Math.ceil(modules / strings);
    const vocCold = perString * panel.voc * 1.13;              // ~ −10 °C correction
    const invKw = nextStd(dcKw / 1.15, [3, 3.6, 5, 6, 8, 10, 12, 15, 20, 25, 33, 50, 75, 110, 150, 200, 250]);
    const acCurrent = phases === 3 ? (invKw * 1000) / (Math.sqrt(3) * 400 * 0.95) : (invKw * 1000) / (230 * 0.95);
    const mcb = nextStd(acCurrent * 1.25, [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400]);
    const acCable = phases === 3
      ? (mcb <= 20 ? "5G4 mm²" : mcb <= 32 ? "5G6 mm²" : mcb <= 63 ? "5G10 mm²" : mcb <= 125 ? "3×35 + 16 mm²" : "3×95 + 50 mm²")
      : (mcb <= 20 ? "3G4 mm²" : "3G6 mm²");
    const filingLabel = (FILINGS[market].find((f) => f.id === filing) || FILINGS[market][0]).label;
    return { panel, modules, dcKw, strings, perString, vocCold, invKw, acCurrent, mcb, acCable, filingLabel };
  }, [kw, phases, market, filing]);

  const loc = docLang === "en" ? "en-IE" : "ro-RO";
  const kv = (label, value) => (
    <div className="doc-kv"><span>{label}</span><b>{value}</b></div>
  );

  const schedule = [
    ["A1", `${d("modules")}: ${DEMO_SYSTEM.panel.brand} ${DEMO_SYSTEM.panel.model}, ${DEMO_SYSTEM.panel.watt} Wp, ${eng.dcKw.toFixed(2)} kWp total`, `${eng.modules}`, "IEC 61215 / IEC 61730"],
    ["A2", `${d("inverter")} ${docLang === "en" ? "hybrid" : "hibrid"}: ${DEMO_SYSTEM.inverter.brand} ${DEMO_SYSTEM.inverter.model}, ${eng.invKw} kW, ${phases === 3 ? "3~ 400 V" : "1~ 230 V"}`, "1", "IEC 62109-1/-2 · SR EN 50549-1"],
    ...(batt ? [["A3", `${d("storage")}: ${DEMO_SYSTEM.battery.brand} ${DEMO_SYSTEM.battery.model}, ${battKwh} kWh, ${DEMO_SYSTEM.battery.chem}`, "1", "IEC 62619 · IEC 63056"]] : []),
    ["B1", `${docLang === "en" ? "DC string fuses" : "Siguranțe fuzibile șir DC"} gPV 15 A / 1000 V DC`, `${eng.strings * 2}`, "IEC 60269-6"],
    ["B2", `${docLang === "en" ? "DC switch-disconnector" : "Separator de sarcină DC"} 1000 V DC / 25 A`, "1", "IEC 60947-3"],
    ["B3", `${docLang === "en" ? "DC surge arrester" : "Descărcător supratensiuni DC"} Type 2, Ucpv 1000 V`, "1", "IEC 61643-31"],
    ["C1", `${docLang === "en" ? "AC miniature circuit-breaker" : "Disjunctor AC"} C${eng.mcb} ${phases === 3 ? "3P" : "1P"}, 6 kA`, "1", "IEC 60898-1"],
    ["C2", `${docLang === "en" ? "Residual-current device, Type B" : "Diferențial Tip B"} ${eng.mcb <= 40 ? 40 : 63} A / 30 mA`, "1", "IEC 62423 / IEC 61008"],
    ["C3", `${docLang === "en" ? "AC surge arrester" : "Descărcător supratensiuni AC"} Type 2, ${phases === 3 ? "4P" : "2P"}`, "1", "IEC 61643-11"],
    ["D1", `${docLang === "en" ? "Bidirectional metering, 4-quadrant, class 1" : "Contor bidirecțional, 4 cadrane, clasa 1"}`, "1", `${market === "MD" ? "SM SR EN 50470" : "SR EN 50470-3"}`],
    ["E1", `${docLang === "en" ? "Mounting system" : "Sistem de montaj"}: ${DEMO_SYSTEM.mount.brand} ${DEMO_SYSTEM.mount.model}`, "1 set", "EN 1991-1-3/-4 (loads)"],
  ];

  const cables = [
    [docLang === "en" ? "DC string cable" : "Cablu șir DC", "H1Z2Z2-K 1×6 mm² Cu", "≤ 12 m/string"],
    [docLang === "en" ? "AC connection cable" : "Cablu racord AC", eng.acCable + " Cu", "inverter → tablou / panou"],
    [docLang === "en" ? "Protective earthing conductor" : "Conductor de protecție (PE)", "16 mm² Cu", "→ bară principală de egalizare"],
    [docLang === "en" ? "Equipotential bonding (frames/rails)" : "Egalizare potențial (rame/șine)", "6 mm² Cu", "IEC 60364-5-54"],
    [docLang === "en" ? "Earthing arrangement" : "Priză de pământ", `TN-S, R ≤ 4 Ω`, "PE 155 / IEC 62305 (LPS if present)"],
  ];

  return (
    <>
      <PreviewHeader slug="annex" lang={lang} title={t("title")} sub={t("sub")}
        right={<button className="btn ghost sm" onClick={() => window.print()}>{t("print")}</button>} />
      <MockNote>{t("note")}</MockNote>

      <ClientBar lang={lang} />

      {/* annex-specific controls */}
      <div className="pv-panel pv-noprint" style={{ marginBottom: 16 }}>
        <div className="an-controls">
          <label className="an-c"><span>{t("filing")}</span>
            <select className="pv-input" value={filing} onChange={(e) => setFiling(e.target.value)}>
              <optgroup label="Moldova">{FILINGS.MD.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>
              <optgroup label="România">{FILINGS.RO.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>
            </select>
          </label>
          <label className="an-c"><span>{t("docLang")}</span>
            <div className="pv-seg">
              <button className={docLang === "ro" ? "on" : ""} onClick={() => setDocLang("ro")}>RO</button>
              <button className={docLang === "en" ? "on" : ""} onClick={() => setDocLang("en")}>EN</button>
            </div>
          </label>
          <div className="an-c"><span>{t("size")}</span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4 }}>
              {eng.dcKw.toFixed(2)} kWp · {eng.modules} {docLang === "en" ? "modules" : "module"} · {phases === 3 ? "3~ 400 V" : "1~ 230 V"}
              {batt ? ` · ${battKwh} kWh` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* the document */}
      <div className="pv-doc-scroll">
      <div className="pv-doc">
        <div className="doc-co">VoltMira · {new Date().toLocaleDateString(loc)} · {d("gen")}</div>
        <h1>{d("h_annex")}</h1>
        <p className="doc-sub">{d("to")}: <b>{eng.filingLabel}</b></p>

        <h2>{d("ident")}</h2>
        <div className="doc-grid">
          {kv(d("beneficiary"), client.name)}
          {kv(d("contract"), client.contractNo)}
          {kv(d("address"), client.address)}
          {kv(d("pod"), "DEA_" + String(client.contractNo).replace(/[^0-9]/g, "").slice(-8))}
          {kv(d("approved"), `${approvedKw} kW`)}
          {kv(d("regime"), d("regime_v"))}
          {kv(d("installer"), "SolarTech SRL")}
          {kv(d("atestat"), client.atestat || (market === "MD" ? "ANRE-MC nr. 2026/PV-0148" : "ANRE tip B nr. 2026/24417"))}
        </div>

        <h2>{d("sys")}</h2>
        <div className="doc-grid">
          {kv(d("pdc"), `${eng.dcKw.toFixed(2)} kWp`)}
          {kv(d("pac"), `${Math.min(eng.invKw, eng.dcKw).toFixed(2)} kW · ${phases === 3 ? "3~ 400 V / 50 Hz" : "1~ 230 V / 50 Hz"}`)}
          {kv(d("modules"), `${eng.modules} × ${DEMO_SYSTEM.panel.brand} ${DEMO_SYSTEM.panel.model} (${DEMO_SYSTEM.panel.watt} Wp)`)}
          {kv(d("strings"), `${eng.strings} × ${eng.perString} ${docLang === "en" ? "modules/string" : "module/șir"}`)}
          {kv(d("voc"), `${eng.vocCold.toFixed(0)} V DC`)}
          {kv(d("isc"), `${(DEMO_SYSTEM.panel.isc * 1.25).toFixed(1)} A`)}
          {kv(d("inverter"), `${DEMO_SYSTEM.inverter.brand} ${DEMO_SYSTEM.inverter.model} · ${eng.invKw} kW · ${DEMO_SYSTEM.inverter.mppt} MPPT`)}
          {batt && kv(d("storage"), `${DEMO_SYSTEM.battery.brand} ${DEMO_SYSTEM.battery.model} · ${battKwh} kWh · ${DEMO_SYSTEM.battery.vdc} V`)}
        </div>

        <h2>{d("sld")}</h2>
        <SLD phases={phases} batt={batt} strings={eng.strings} mcb={eng.mcb} invKw={eng.invKw}
          modules={eng.modules} docLang={docLang} market={market} />

        <h2>{d("sched")}</h2>
        <table>
          <thead><tr><th style={{ width: 44 }}>{d("c_item")}</th><th>{d("c_desc")}</th><th style={{ width: 46 }}>{d("c_qty")}</th><th style={{ width: 200 }}>{d("c_std")}</th></tr></thead>
          <tbody>{schedule.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}</tbody>
        </table>

        <h2>{d("prot")}</h2>
        <table>
          <thead><tr><th>{d("p_fn")}</th><th style={{ width: 160 }}>{d("p_set")}</th><th style={{ width: 120 }}>{d("p_t")}</th></tr></thead>
          <tbody>{protRows(docLang === "en" ? "en" : "ro").map((p, i) => <tr key={i}><td>{p.fn}</td><td>{p.set}</td><td>{p.time}</td></tr>)}</tbody>
        </table>

        <h2>{d("cables")}</h2>
        <table>
          <tbody>{cables.map((r) => <tr key={r[0]}><td style={{ width: 260 }}>{r[0]}</td><td><b>{r[1]}</b></td><td>{r[2]}</td></tr>)}</tbody>
        </table>

        <h2>{d("decl")}</h2>
        <p style={{ fontSize: "11px" }}>{d("decl_v")}</p>
        <div className="doc-sign">
          <div>{d("sign_inst")}</div>
          <div>{d("sign_ben")}</div>
        </div>
        <p className="doc-note">{d("date")}: {new Date().toLocaleDateString(loc)} · {d("gen")}</p>
      </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .an-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 18px;align-items:end}
        .an-c{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--muted)}
        .an-c > span{line-height:1.35}
        .an-toggle{flex-direction:row;align-items:center;gap:9px;cursor:pointer}
        .an-toggle input{width:16px;height:16px;accent-color:var(--green)}
      ` }} />
    </>
  );
}

/* --------------------------------------------------- single-line diagram ---- */
// A box whose title may carry a "\n" for a two-line label — so long RO strings
// ("Separator + siguranțe DC") stay inside the box instead of spilling out.
function SldBox({ x, y, w, h, title, sub, sub2 }) {
  const lines = String(title).split("\n");
  const topY = lines.length > 1 ? y + 15 : y + 18;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#fff" stroke="#14211b" strokeWidth="1.3" />
      {lines.map((ln, i) => (
        <text key={i} x={x + w / 2} y={topY + i * 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#14211b">{ln}</text>
      ))}
      {sub && <text x={x + w / 2} y={y + (lines.length > 1 ? 42 : 34)} textAnchor="middle" fontSize="8.4" fill="#555">{sub}</text>}
      {sub2 && <text x={x + w / 2} y={y + (lines.length > 1 ? 53 : 46)} textAnchor="middle" fontSize="8.4" fill="#555">{sub2}</text>}
    </g>
  );
}
function SLD({ phases, batt, strings, mcb, invKw, modules, docLang }) {
  const L = (ro, en) => (docLang === "en" ? en : ro);
  const BW = 140, BH = 64, yMain = 92;
  const H = batt ? 270 : 196, W = 902;
  const cols = [12, 172, 336, 500, 664];          // cols[0] = PV array, 1..4 = boxes
  const gcx = cols[4] + BW + 30;                   // grid symbol centre
  const boxY = yMain - BH / 2;
  const wire = (x1, x2, y = yMain) => <line x1={x1} y1={y} x2={x2} y2={y} stroke="#14211b" strokeWidth="1.3" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 680, background: "#FCFBF7", border: "1px solid #E5E2D6", borderRadius: 8 }}>
        {/* PV array */}
        <rect x={cols[0]} y={yMain - 34} width={118} height={68} rx="5" fill="#fff" stroke="#14211b" strokeWidth="1.3" />
        {[0, 1, 2].map((i) => [0, 1, 2].map((j) => (
          <rect key={i + "-" + j} x={cols[0] + 12 + j * 32} y={yMain - 26 + i * 20} width={26} height={16} fill="#E4EDF4" stroke="#3D6B8E" strokeWidth="0.7" />
        )))}
        <text x={cols[0] + 59} y={yMain + 50} textAnchor="middle" fontSize="9" fill="#555">{modules} {L("module", "modules")} · {strings} {L("șiruri", "strings")}</text>
        {wire(cols[0] + 118, cols[1])}

        {/* DC isolator + fuses */}
        <SldBox x={cols[1]} y={boxY} w={BW} h={BH} title={L("Separator +\nsiguranțe DC", "DC isolator +\nfuses")} sub="gPV 15 A · 1000 V" sub2="IEC 60947-3" />
        <line x1={cols[1] + BW / 2} y1={boxY + BH} x2={cols[1] + BW / 2} y2={boxY + BH + 16} stroke="#14211b" strokeWidth="1.1" />
        <text x={cols[1] + BW / 2} y={boxY + BH + 26} textAnchor="middle" fontSize="7.6" fill="#555">SPD T2 DC</text>
        {wire(cols[1] + BW, cols[2])}

        {/* Inverter (+ battery branch) */}
        <SldBox x={cols[2]} y={boxY} w={BW} h={BH} title={`${DEMO_SYSTEM.inverter.brand} ${L("invertor", "inverter")}`} sub={`${invKw} kW · ${phases === 3 ? "3~" : "1~"} · MPPT`} sub2="SR EN 50549-1 · LoM" />
        {batt && (
          <>
            <line x1={cols[2] + BW / 2} y1={boxY + BH} x2={cols[2] + BW / 2} y2={yMain + 78} stroke="#14211b" strokeWidth="1.3" />
            <SldBox x={cols[2]} y={yMain + 78} w={BW} h={BH} title={L("Baterie", "Battery")} sub="9.6 kWh · 48 V DC" sub2="BMS · IEC 62619" />
          </>
        )}
        {wire(cols[2] + BW, cols[3])}

        {/* AC breaker + RCD */}
        <SldBox x={cols[3]} y={boxY} w={BW} h={BH} title={L(`Disjunctor C${mcb} +\nRCD tip B`, `MCB C${mcb} +\nRCD type B`)} sub={`${phases === 3 ? "4P" : "2P"} · 30 mA · 6 kA`} sub2="IEC 62423 · SPD T2 AC" />
        {wire(cols[3] + BW, cols[4])}

        {/* Meter */}
        <SldBox x={cols[4]} y={boxY} w={BW} h={BH} title={L("Contor\nbidirecțional", "Bidirectional\nmeter")} sub={L("4 cadrane · clasa 1", "4-quadrant · class 1")} sub2="SR EN 50470" />
        {wire(cols[4] + BW, gcx - 22)}

        {/* Grid */}
        <circle cx={gcx} cy={yMain} r="22" fill="#fff" stroke="#14211b" strokeWidth="1.3" />
        <path d={`M${gcx - 14} ${yMain} q 7 -10 14 0 q 7 10 14 0`} fill="none" stroke="#14211b" strokeWidth="1.2" />
        <text x={gcx} y={yMain + 40} textAnchor="middle" fontSize="9" fill="#555">{L("Rețea 0,4 kV", "Grid 0.4 kV")}</text>
        <text x={gcx} y={yMain - 32} textAnchor="middle" fontSize="8" fill="#3D6B8E" fontWeight="700">POD</text>
        <line x1={cols[4] + BW + 4} y1={yMain - 26} x2={cols[4] + BW + 4} y2={yMain + 26} stroke="#3D6B8E" strokeWidth="1" strokeDasharray="3 3" />

        {/* Main earth */}
        <line x1={cols[3] + BW / 2} y1={boxY + BH} x2={cols[3] + BW / 2} y2={H - 24} stroke="#14211b" strokeWidth="1.1" />
        <line x1={cols[3] + BW / 2 - 16} y1={H - 24} x2={cols[3] + BW / 2 + 16} y2={H - 24} stroke="#14211b" strokeWidth="1.6" />
        <line x1={cols[3] + BW / 2 - 10} y1={H - 19} x2={cols[3] + BW / 2 + 10} y2={H - 19} stroke="#14211b" strokeWidth="1.3" />
        <line x1={cols[3] + BW / 2 - 5} y1={H - 14} x2={cols[3] + BW / 2 + 5} y2={H - 14} stroke="#14211b" strokeWidth="1" />
        <text x={cols[3] + BW / 2 + 26} y={H - 16} fontSize="8" fill="#555">PE 16 mm² · TN-S</text>
      </svg>
    </div>
  );
}
