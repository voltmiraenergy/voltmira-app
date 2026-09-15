"use client";
// Studio · Payments & cashflow.
// Every job's money on one screen — deposit + balance with amount and date, an
// overdue flag, a month cashflow view, and the fiscal invoice (+ SFS e-Factura
// XML for a company client). Mock ledger; the active client's contract value and
// the XML are derived from the engine + the client bar.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, downloadStudioDoc,
  useStudioClient, ClientBar, engineSettings,
} from "../studio-kit.jsx";
import { simulate, FX, effectiveYield } from "../_engine.js";

const TX = {
  title: { en: "Payments & cashflow", ro: "Încasări & flux de numerar", ru: "Оплаты и денежный поток" },
  sub: {
    en: "Deposit, balance, due dates and overdue flags per job — plus the month's in / owed / committed, and the fiscal invoice generated from the quote.",
    ro: "Avans, rest, termene și marcaje de întârziere per lucrare — plus încasat / de încasat / angajat pe lună, și factura fiscală generată din ofertă.",
    ru: "Аванс, остаток, сроки и флаги просрочки по объекту — плюс за месяц получено / к получению / законтрактовано и налоговая накладная из расчёта.",
  },
  note: {
    en: "Add your real jobs below — deposit, balance and status are yours to set, and the month's cashflow adds them up live. The list is saved in this browser. The active client (green row) comes straight from the client bar and the engine.",
    ro: "Adaugă lucrările tale reale mai jos — avansul, restul și starea le setezi tu, iar fluxul lunii le însumează live. Lista se salvează în acest browser. Clientul activ (rândul verde) vine direct din bara de client și din motor.",
    ru: "Добавляйте свои реальные объекты ниже — аванс, остаток и статус задаёте вы, а денежный поток месяца суммирует их вживую. Список сохраняется в этом браузере. Активный клиент (зелёная строка) — из панели клиента и движка.",
  },
  addJob: { en: "Add a job", ro: "Adaugă o lucrare", ru: "Добавить объект" },
  add: { en: "Add", ro: "Adaugă", ru: "Добавить" },
  cancel: { en: "Cancel", ro: "Anulează", ru: "Отмена" },
  remove: { en: "Delete", ro: "Șterge", ru: "Удалить" },
  loadSample: { en: "Load sample jobs", ro: "Încarcă lucrări exemplu", ru: "Загрузить примеры" },
  jName: { en: "Client / job", ro: "Client / lucrare", ru: "Клиент / объект" },
  jLoc: { en: "Location", ro: "Localitate", ru: "Локация" },
  jContract: { en: "Contract (lei)", ro: "Contract (lei)", ru: "Контракт (лей)" },
  jDep: { en: "Deposit %", ro: "Avans %", ru: "Аванс %" },
  emptyJobs: { en: "No jobs yet — add one above, or load a few samples.", ro: "Încă nicio lucrare — adaugă una mai sus, sau încarcă câteva exemple.", ru: "Пока нет объектов — добавьте выше или загрузите примеры." },
  markPaidDep: { en: "deposit paid", ro: "avans plătit", ru: "аванс оплачен" },
  markDone: { en: "settled", ro: "achitat", ru: "закрыт" },
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
  print: { en: "Print / PDF", ro: "Printează / PDF", ru: "Печать / PDF" },
};

// Same cast as the install schedule and the service log — loaded on demand via
// "load sample jobs", never duplicating the active client's own row above it.
const MOCK_JOBS = [
  { name: "Elena Ciobanu", loc: "Chișinău, Botanica", eur: 12400, depPct: 30, depPaid: true, balDays: 8, done: false },
  { name: "Andrei Postică", loc: "Strășeni", eur: 6600, depPct: 30, depPaid: false, balDays: null, done: false },
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
      yieldOverride: effectiveYield(client),
    }, E, "expc");
    return sim.grossCost;
  }, [client]);

  const dayU = tx({ en: "days", ro: "zile", ru: "дн." }, lang);

  // The jobs ledger is real and editable — saved in this browser. The active
  // client (from the client bar + engine) is always pinned as the first row.
  const [saved, setSaved] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", loc: "", lei: "", depPct: 30 });
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("voltmira_studio_jobs") || "null");
      if (Array.isArray(s)) setSaved(s);
    } catch { /* private mode */ }
  }, []);
  const persist = (next) => {
    setSaved(next);
    try { localStorage.setItem("voltmira_studio_jobs", JSON.stringify(next)); } catch { /* private mode */ }
  };
  const addJob = () => {
    const eur = (+form.lei || 0) / FX.MDL;
    if (!form.name.trim() || eur <= 0) return;
    persist([...saved, { id: Date.now(), name: form.name.trim(), loc: form.loc.trim(), eur, depPct: +form.depPct || 30, depPaid: false, balDays: null, done: false }]);
    setForm({ name: "", loc: "", lei: "", depPct: 30 }); setAdding(false);
  };
  const patchJob = (id, p) => persist(saved.map((j) => (j.id === id ? { ...j, ...p } : j)));
  const delJob = (id) => persist(saved.filter((j) => j.id !== id));
  const loadSampleJobs = () => persist(MOCK_JOBS.map((m, i) => ({ ...m, id: Date.now() + i })));

  const activeJob = { id: "active", name: client.name, loc: String(client.address).split(",")[0], eur: activeEur, depPct: 30, depPaid: false, balDays: null, done: false, active: true };
  const jobs = [activeJob, ...saved];

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

  const gross = activeEur * FX.MDL;
  const netMdl = gross / 1.2, vatMdl = gross - netMdl;

  return (
    <>
      <PreviewHeader slug="payments" lang={lang} title={T(TX.title)} sub={T(TX.sub)}
        right={<button className="btn ghost sm" onClick={() => downloadStudioDoc("factura")}>{T(TX.print)}</button>} />
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{T(TX.jobs)}</h3>
          {saved.length === 0 && <button className="btn ghost sm" onClick={loadSampleJobs}>{T(TX.loadSample)}</button>}
          <button className="btn primary sm" onClick={() => setAdding((v) => !v)}>{adding ? T(TX.cancel) : "+ " + T(TX.addJob)}</button>
        </div>

        {adding && (
          <div className="pmt-form">
            <label>{T(TX.jName)}<input className="pv-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
            <label>{T(TX.jLoc)}<input className="pv-input" value={form.loc} onChange={(e) => setForm((f) => ({ ...f, loc: e.target.value }))} /></label>
            <label>{T(TX.jContract)}<input className="pv-input" type="number" min="0" value={form.lei} onChange={(e) => setForm((f) => ({ ...f, lei: e.target.value }))} /></label>
            <label>{T(TX.jDep)}<input className="pv-input" type="number" min="0" max="100" value={form.depPct} onChange={(e) => setForm((f) => ({ ...f, depPct: e.target.value }))} /></label>
            <button className="btn primary sm" onClick={addJob}>{T(TX.add)}</button>
          </div>
        )}

        <div className="pv-tbl-wrap">
          <table className="pv-tbl">
            <thead><tr>
              <th>{T(TX.c_client)}</th><th className="th-r">{T(TX.c_value)}</th>
              <th className="th-r">{T(TX.c_dep)}</th><th className="th-r">{T(TX.c_bal)}</th><th>{T(TX.c_state)}</th><th></th>
            </tr></thead>
            <tbody>
              {jobs.map((j) => {
                const dep = j.eur * j.depPct / 100;
                const bal = j.eur - dep;
                const [lbl, cls] = stateOf(j);
                return (
                  <tr key={j.id} style={j.active ? { background: "var(--green-tint)" } : undefined}>
                    <td><b>{j.name}</b><div style={{ color: "var(--muted)", fontSize: 11.5 }}>{j.loc}</div></td>
                    <td className="num">{lei(j.eur)}</td>
                    <td className="num">{lei(dep)}<div style={{ fontSize: 10.5, color: j.depPaid ? "var(--green)" : "var(--muted)" }}>{j.depPct}% · {j.depPaid ? T(TX.paid) : T(TX.awaiting)}</div></td>
                    <td className="num">{j.done ? <span style={{ color: "var(--muted)" }}>—</span> : lei(bal)}
                      {j.balDays != null && !j.done && <div style={{ fontSize: 10.5, color: j.balDays < 0 ? "#B4472F" : "var(--muted)" }}>
                        {j.balDays < 0 ? `${-j.balDays} ${dayU} · ${T(TX.overdue)}` : `${T(TX.due)} · +${j.balDays} ${dayU}`}</div>}
                    </td>
                    <td><span className={"pmt-st " + cls}>{T(TX[lbl])}</span></td>
                    <td>
                      {j.active ? <span style={{ color: "var(--muted)", fontSize: 10.5 }}>—</span> : (
                        <div className="pmt-acts">
                          <button className={"pmt-mini" + (j.depPaid ? " on" : "")} title={T(TX.markPaidDep)} onClick={() => patchJob(j.id, { depPaid: !j.depPaid })}>{T(TX.markPaidDep)}</button>
                          <button className={"pmt-mini" + (j.done ? " on" : "")} title={T(TX.markDone)} onClick={() => patchJob(j.id, { done: !j.done, depPaid: j.done ? j.depPaid : true })}>{T(TX.markDone)}</button>
                          <button className="pmt-mini del" title={T(TX.remove)} onClick={() => delJob(j.id)}>×</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {saved.length === 0 && (
                <tr><td colSpan={6} style={{ color: "var(--muted)", fontSize: 12, padding: "14px 10px" }}>{T(TX.emptyJobs)}</td></tr>
              )}
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
        .pmt-form{display:grid;grid-template-columns:2fr 1.4fr 1.2fr .8fr auto;gap:10px;align-items:end;
          background:var(--paper);border:1px solid var(--line);border-radius:11px;padding:13px;margin-bottom:14px}
        @media(max-width:720px){.pmt-form{grid-template-columns:1fr 1fr}}
        .pmt-form label{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:600;color:var(--muted)}
        .pmt-acts{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
        .pmt-mini{font-family:inherit;font-size:10.5px;font-weight:600;border:1px solid var(--line);background:var(--paper-2);
          color:var(--muted);border-radius:7px;padding:4px 8px;cursor:pointer;white-space:nowrap;transition:all .14s}
        .pmt-mini:hover{border-color:var(--green);color:var(--green)}
        .pmt-mini.on{background:var(--green);border-color:var(--green);color:#fff}
        .pmt-mini.del{color:var(--red);font-size:13px;line-height:1;padding:4px 9px}
        .pmt-mini.del:hover{border-color:var(--red);background:var(--red);color:#fff}
      ` }} />
    </>
  );
}
