"use client";
// Studio · Payments & cashflow.
// Every job's money on one screen — deposit + balance with amount and date, an
// overdue flag, a month cashflow view, and the fiscal invoice (+ SFS e-Factura
// XML for a company client). Mock ledger; the active client's contract value and
// the XML are derived from the engine + the client bar.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM,
  useStudioClient, ClientBar, engineSettings,
} from "../studio-kit.jsx";
import { simulate, FX } from "../_engine.js";

const TX = {
  title: { en: "Payments & cashflow", ro: "Încasări & flux de numerar", ru: "Оплаты и денежный поток" },
  sub: {
    en: "Deposit, balance, due dates and overdue flags per job — plus the month's in / owed / committed, and the fiscal invoice generated from the quote.",
    ro: "Avans, rest, termene și marcaje de întârziere per lucrare — plus încasat / de încasat / angajat pe lună, și factura fiscală generată din ofertă.",
    ru: "Аванс, остаток, сроки и флаги просрочки по объекту — плюс за месяц получено / к получению / законтрактовано и налоговая накладная из расчёта.",
  },
  note: {
    en: "The active client's contract value comes from the engine; the e-Factura XML is built from the client bar and your invoicing details in Settings.",
    ro: "Valoarea contractului clientului activ vine din motor; XML-ul e-Factura se construiește din bara de client și datele tale de facturare din Setări.",
    ru: "Стоимость контракта активного клиента из движка; XML e-Factura строится из панели клиента и ваших реквизитов в Настройках.",
  },
  month: { en: "This month", ro: "Luna aceasta", ru: "Этот месяц" },
  received: { en: "Received", ro: "Încasat", ru: "Получено" },
  owed: { en: "Owed to you", ro: "De încasat", ru: "К получению" },
  committed: { en: "Committed to suppliers", ro: "Angajat la furnizori", ru: "Законтрактовано" },
  net: { en: "Net position", ro: "Poziție netă", ru: "Чистая позиция" },
  jobs: { en: "Jobs", ro: "Lucrări", ru: "Объекты" },
  c_client: { en: "Client", ro: "Client", ru: "Клиент" },
  c_value: { en: "Contract", ro: "Contract", ru: "Контракт" },
  c_dep: { en: "Deposit", ro: "Avans", ru: "Аванс" },
  c_bal: { en: "Balance", ro: "Rest", ru: "Остаток" },
  c_state: { en: "State", ro: "Stare", ru: "Статус" },
  paid: { en: "paid", ro: "plătit", ru: "оплачен" },
  due: { en: "due", ro: "scadent", ru: "к оплате" },
  overdue: { en: "overdue", ro: "întârziat", ru: "просрочен" },
  awaiting: { en: "awaiting deposit", ro: "așteaptă avansul", ru: "ждём аванс" },
  done: { en: "settled", ro: "achitat", ru: "закрыт" },
  invoice: { en: "Fiscal invoice", ro: "Factură fiscală", ru: "Налоговая накладная" },
  invNo: { en: "Invoice no.", ro: "Nr. factură", ru: "№ накладной" },
  invClient: { en: "Buyer", ro: "Cumpărător", ru: "Покупатель" },
  invLine: { en: "PV system, turnkey", ro: "Sistem fotovoltaic, la cheie", ru: "ФЭ-система, под ключ" },
  invNet: { en: "Net", ro: "Fără TVA", ru: "Без НДС" },
  invVat: { en: "VAT 20%", ro: "TVA 20%", ru: "НДС 20%" },
  invTot: { en: "Total", ro: "Total", ru: "Итого" },
  xml: { en: "Generate e-Factura XML (SFS)", ro: "Generează XML e-Factura (SFS)", ru: "Сформировать XML e-Factura (SFS)" },
  xmlDone: { en: "XML generated ✓", ro: "XML generat ✓", ru: "XML сформирован ✓" },
  xmlNote: {
    en: "e-Factura is mandatory for VAT-payer B2B in Moldova; a residential job also just needs the printed invoice above.",
    ro: "e-Factura e obligatorie pentru B2B plătitor de TVA în Moldova; pentru o lucrare rezidențială e suficientă și factura printată de mai sus.",
    ru: "e-Factura обязательна для B2B плательщиков НДС в Молдове; для жилого объекта достаточно и печатной накладной выше.",
  },
  xmlReady: { en: "XML ready — 1 invoice line, VAT 20%, buyer IDNO filled — ready to upload to the SFS portal", ro: "XML gata — 1 linie factură, TVA 20%, IDNO cumpărător completat — gata de încărcat pe portalul SFS", ru: "XML готов — 1 строка, НДС 20%, IDNO покупателя заполнен — можно загружать на портал SFS" },
  xmlResid: { en: "XML generated. Not required for this residential job — keep it if you're a VAT payer.", ro: "XML generat. Nu e obligatoriu pentru această lucrare rezidențială — păstrează-l dacă ești plătitor de TVA.", ru: "XML сформирован. Для этого жилого объекта не обязателен — сохраните, если вы плательщик НДС." },
  print: { en: "Print / PDF", ro: "Printează / PDF", ru: "Печать / PDF" },
};

const MOCK_JOBS = [
  { name: "Familia Rusu", loc: "Ialoveni", eur: 8100, depPct: 40, depPaid: true, balDays: -3, done: false },
  { name: "Elena C.", loc: "Chișinău, Botanica", eur: 12400, depPct: 30, depPaid: true, balDays: 8, done: false },
  { name: "Andrei P.", loc: "Strășeni", eur: 6600, depPct: 30, depPaid: false, balDays: null, done: false },
  { name: "Hala AgroNord SRL", loc: "Chișinău", eur: 46000, depPct: 30, depPaid: true, balDays: null, done: false },
  { name: "Familia Ceban", loc: "Bălți", eur: 7250, depPct: 50, depPaid: true, balDays: null, done: true },
];

export default function PaymentsPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Payments & cashflow — VoltMira Studio"; }, []);

  const activeEur = useMemo(() => {
    const E = engineSettings();
    const sim = simulate({
      market: client.market, kw: +client.kw || 0, price: +client.price || 0.185,
      cons: +client.cons || 0, batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0,
      yieldOverride: 1235,
    }, E, "expc");
    return sim.grossCost;
  }, [client]);

  const [xml, setXml] = useState(false);
  const dayU = tx({ en: "days", ro: "zile", ru: "дн." }, lang);

  const jobs = [
    { name: client.name, loc: String(client.address).split(",")[0], eur: activeEur, depPct: 30, depPaid: false, balDays: null, done: false, active: true },
    ...MOCK_JOBS,
  ];

  const lei = (e) => NUM(e * FX.MDL) + " lei";
  let received = 0, owed = 0;
  for (const j of jobs) {
    const dep = j.eur * j.depPct / 100;
    const bal = j.eur - dep;
    if (j.depPaid) received += dep;
    else owed += dep;
    if (j.done) received += bal;
    else if (j.depPaid) owed += bal;
  }
  const committed = 61800; // mock supplier POs outstanding

  function stateOf(j) {
    if (j.done) return ["done", "done"];
    if (!j.depPaid) return ["awaiting", "await"];
    if (j.balDays == null) return ["paid", "ok"];       // deposit paid, balance not yet invoiced
    if (j.balDays < 0) return ["overdue", "bad"];
    return ["due", "due"];
  }

  const net = client.market === "MD" || true; // MD VAT 20%
  const gross = activeEur * FX.MDL;
  const netMdl = gross / 1.2, vatMdl = gross - netMdl;
  const commercial = (+client.kw || 0) >= 30;

  return (
    <>
      <PreviewHeader slug="payments" lang={lang} title={T(TX.title)} sub={T(TX.sub)}
        right={<button className="btn ghost sm" onClick={() => window.print()}>{T(TX.print)}</button>} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      {/* cashflow */}
      <div className="pv-panel pv-noprint">
        <h3>{T(TX.month)}</h3>
        <div className="pv-metrics">
          <div className="pv-metric good"><b>{lei(received)}</b><span>{T(TX.received)}</span></div>
          <div className="pv-metric"><b>{lei(owed)}</b><span>{T(TX.owed)}</span></div>
          <div className="pv-metric warn"><b>{NUM(committed * FX.MDL)} lei</b><span>{T(TX.committed)}</span></div>
          <div className="pv-metric"><b>{lei(received + owed - committed)}</b><span>{T(TX.net)}</span></div>
        </div>
      </div>

      {/* jobs ledger */}
      <div className="pv-panel pv-noprint">
        <h3>{T(TX.jobs)}</h3>
        <div className="pv-tbl-wrap">
          <table className="pv-tbl">
            <thead><tr>
              <th>{T(TX.c_client)}</th><th className="th-r">{T(TX.c_value)}</th>
              <th className="th-r">{T(TX.c_dep)}</th><th className="th-r">{T(TX.c_bal)}</th><th>{T(TX.c_state)}</th>
            </tr></thead>
            <tbody>
              {jobs.map((j, i) => {
                const dep = j.eur * j.depPct / 100;
                const bal = j.eur - dep;
                const [lbl, cls] = stateOf(j);
                return (
                  <tr key={i} style={j.active ? { background: "var(--green-tint)" } : undefined}>
                    <td><b>{j.name}</b><div style={{ color: "var(--muted)", fontSize: 11.5 }}>{j.loc}</div></td>
                    <td className="num">{lei(j.eur)}</td>
                    <td className="num">{lei(dep)}<div style={{ fontSize: 10.5, color: j.depPaid ? "var(--green)" : "var(--muted)" }}>{j.depPct}% · {j.depPaid ? T(TX.paid) : T(TX.awaiting)}</div></td>
                    <td className="num">{j.done ? <span style={{ color: "var(--muted)" }}>—</span> : lei(bal)}
                      {j.balDays != null && !j.done && <div style={{ fontSize: 10.5, color: j.balDays < 0 ? "#B4472F" : "var(--muted)" }}>
                        {j.balDays < 0 ? `${-j.balDays} ${dayU} · ${T(TX.overdue)}` : `${T(TX.due)} · +${j.balDays} ${dayU}`}</div>}
                    </td>
                    <td><span className={"pmt-st " + cls}>{T(TX[lbl])}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* fiscal invoice */}
      <div className="pv-doc-scroll">
        <div className="pv-doc">
          <div className="doc-co">VoltMira · {new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : "ro-RO")} · {tx({ ro: "factură — verificați cu contabilul", en: "invoice — verify with your accountant", ru: "проверьте с бухгалтером" }, lang)}</div>
          <h1>{T(TX.invoice).toUpperCase()}</h1>
          <div className="doc-grid">
            <div className="doc-kv"><span>{T(TX.invNo)}</span><b>FF-2026-0148</b></div>
            <div className="doc-kv"><span>{T(TX.invClient)}</span><b>{client.name}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Adresă", en: "Address", ru: "Адрес" }, lang)}</span><b>{client.address}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Nr. contract", en: "Contract no.", ru: "№ договора" }, lang)}</span><b>{client.contractNo}</b></div>
          </div>
          <table>
            <thead><tr><th>{tx({ ro: "Denumire", en: "Description", ru: "Наименование" }, lang)}</th><th style={{ width: 60 }}>{tx({ ro: "Cant.", en: "Qty", ru: "Кол." }, lang)}</th><th style={{ width: 150 }}>{tx({ ro: "Valoare", en: "Amount", ru: "Сумма" }, lang)}</th></tr></thead>
            <tbody>
              <tr><td>{T(TX.invLine)} — {(+client.kw || 0).toFixed(1)} kW{+client.batteryKwh > 0 ? ` + ${client.batteryKwh} kWh` : ""}</td><td>1</td><td>{NUM(netMdl)} lei</td></tr>
            </tbody>
          </table>
          <div className="doc-grid" style={{ maxWidth: 320, marginLeft: "auto" }}>
            <div className="doc-kv"><span>{T(TX.invNet)}</span><b>{NUM(netMdl)} lei</b></div>
            <div className="doc-kv"><span>{T(TX.invVat)}</span><b>{NUM(vatMdl)} lei</b></div>
            <div className="doc-kv"><span>{T(TX.invTot)}</span><b>{NUM(gross)} lei</b></div>
          </div>
          <p className="doc-note">{tx({ ro: `Echivalent €${NUM(activeEur)} la cursul BNM. Plata prin transfer în contul din antet, ref. FF-2026-0148.`, en: `€${NUM(activeEur)} equivalent at the BNM rate. Payment by transfer to the account in the header, ref. FF-2026-0148.`, ru: `Эквивалент €${NUM(activeEur)} по курсу BNM. Оплата переводом на счёт в шапке, реф. FF-2026-0148.` }, lang)}</p>

          <div className="pv-noprint" style={{ marginTop: 16 }}>
            <button className={"btn sm " + (xml ? "ghost" : "primary")} disabled={xml} onClick={() => setXml(true)}>
              {xml ? T(TX.xmlDone) : T(TX.xml)}
            </button>
            {xml && (
              <div className="qt-flag ok" style={{ marginTop: 10 }}>
                {commercial ? T(TX.xmlReady) : T(TX.xmlResid)}
              </div>
            )}
            <p className="doc-note" style={{ marginTop: 8 }}>{T(TX.xmlNote)}</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .pmt-st{font-family:var(--font-m,monospace);font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
          border-radius:99px;padding:3px 9px}
        .pmt-st.ok{background:var(--green-tint);color:var(--green)}
        .pmt-st.done{background:var(--green-tint);color:var(--green)}
        .pmt-st.due{background:var(--amber-tint);color:#B4700F}
        .pmt-st.await{background:var(--paper-3);color:var(--muted)}
        .pmt-st.bad{background:var(--amber-tint);color:#B4472F}
        .qt-flag{border-radius:9px;padding:10px 13px;font-size:12.5px;font-weight:600}
        .qt-flag.ok{background:var(--green-tint);color:var(--green)}
      ` }} />
    </>
  );
}
