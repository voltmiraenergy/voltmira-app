"use client";
// Studio · Payments & cashflow.
// Every job's money on one screen — deposit + balance with amount and date, an
// overdue flag, a month cashflow view, and the fiscal invoice (+ SFS e-Factura
// XML for a company client). Mock ledger; the active client's contract value and
// the XML are derived from the engine + the client bar.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM, downloadStudioDoc,
  useStudioClient, useStudioJobs, ClientBar, useToast, DocReveal,
  jobMoneySummary, setPayRecord,
} from "../studio-kit.jsx";
import { FX } from "../_engine.js";

const TX = {
  title: { en: "Payments & cashflow", ro: "Încasări & flux de numerar", ru: "Оплаты и денежный поток", uk: "Оплати й грошовий потік" },
  sub: {
    en: "Deposit, balance, due dates and overdue flags per job, plus the month's in / owed / committed, and the fiscal invoice generated from the quote.",
    ro: "Avans, rest, termene și marcaje de întârziere per lucrare, plus încasat / de încasat / angajat pe lună, și factura fiscală generată din ofertă.",
    ru: "Аванс, остаток, сроки и флаги просрочки по объекту, плюс за месяц получено / к получению / законтрактовано и налоговая накладная из расчёта.",
    uk: "Аванс, залишок, строки й позначки прострочення за об’єктом, а також за місяць отримано / до отримання / законтрактовано і податкова накладна з розрахунку.",
  },
  note: {
    en: "Every job from the Studio hub, with its real deposit/balance worked out from the quote. Mark a deposit paid or a job settled here, and the hub's money badge updates too. The month's cashflow adds them all up live.",
    ro: "Toate lucrările din hub-ul Studio, cu avans/rest calculate real din ofertă. Marchează aici avansul plătit sau lucrarea achitată, și eticheta de bani din hub se actualizează la fel. Fluxul lunii le însumează live.",
    ru: "Все объекты из хаба Studio, с реальным авансом/остатком по расчёту. Отметьте здесь оплату аванса или закрытие объекта, и денежный значок в хабе обновится так же. Денежный поток месяца суммирует их вживую.",
    uk: "Усі об’єкти з хабу Studio, з реальним авансом/залишком за розрахунком. Позначте тут оплату авансу або закриття об’єкта, і грошовий значок у хабі оновиться так само. Грошовий потік місяця підсумовує їх наживо.",
  },
  addJobLink: { en: "Add a job from the Studio hub →", ro: "Adaugă o lucrare din hub-ul Studio →", ru: "Добавить объект в хабе Studio →", uk: "Додати об’єкт у хабі Studio →" },
  markPaidDep: { en: "deposit paid", ro: "avans plătit", ru: "аванс оплачен", uk: "аванс оплачено" },
  markDone: { en: "settled", ro: "achitat", ru: "закрыт", uk: "закрито" },
  month: { en: "This month", ro: "Luna aceasta", ru: "Этот месяц", uk: "Цей місяць" },
  received: { en: "Received", ro: "Încasat", ru: "Получено", uk: "Отримано" },
  owed: { en: "Owed to you", ro: "De încasat", ru: "К получению", uk: "До отримання" },
  committed: { en: "Committed to suppliers", ro: "Angajat la furnizori", ru: "Законтрактовано", uk: "Законтрактовано" },
  net: { en: "Net position", ro: "Poziție netă", ru: "Чистая позиция", uk: "Чиста позиція" },
  jobs: { en: "Jobs", ro: "Lucrări", ru: "Объекты", uk: "Об’єкти" },
  c_client: { en: "Client", ro: "Client", ru: "Клиент", uk: "Клієнт" },
  c_value: { en: "Contract", ro: "Contract", ru: "Контракт", uk: "Контракт" },
  c_dep: { en: "Deposit", ro: "Avans", ru: "Аванс", uk: "Аванс" },
  c_bal: { en: "Balance", ro: "Rest", ru: "Остаток", uk: "Залишок" },
  c_state: { en: "State", ro: "Stare", ru: "Статус", uk: "Статус" },
  paid: { en: "paid", ro: "plătit", ru: "оплачен", uk: "оплачено" },
  due: { en: "due", ro: "scadent", ru: "к оплате", uk: "до оплати" },
  overdue: { en: "overdue", ro: "întârziat", ru: "просрочен", uk: "прострочено" },
  awaiting: { en: "awaiting deposit", ro: "așteaptă avansul", ru: "ждём аванс", uk: "чекаємо аванс" },
  done: { en: "settled", ro: "achitat", ru: "закрыт", uk: "закрито" },
  invoice: { en: "Fiscal invoice", ro: "Factură fiscală", ru: "Налоговая накладная", uk: "Податкова накладна" },
  invNo: { en: "Invoice no.", ro: "Nr. factură", ru: "№ накладной", uk: "№ накладної" },
  invClient: { en: "Buyer", ro: "Cumpărător", ru: "Покупатель", uk: "Покупець" },
  invLine: { en: "PV system, turnkey", ro: "Sistem fotovoltaic, la cheie", ru: "ФЭ-система, под ключ", uk: "ФЕ-система, під ключ" },
  invNet: { en: "Net", ro: "Fără TVA", ru: "Без НДС", uk: "Без ПДВ" },
  invVat: { en: "VAT 20%", ro: "TVA 20%", ru: "НДС 20%", uk: "ПДВ 20%" },
  invTot: { en: "Total", ro: "Total", ru: "Итого", uk: "Разом" },
  print: { en: "Print / PDF", ro: "Printează / PDF", ru: "Печать / PDF", uk: "Друк / PDF" },
  t_added: { en: "Job added", ro: "Lucrare adăugată", ru: "Объект добавлен", uk: "Об’єкт додано" },
  t_removed: { en: "Job removed", ro: "Lucrare ștearsă", ru: "Объект удалён", uk: "Об’єкт видалено" },
  t_depOn: { en: "Marked deposit paid", ro: "Marcat avans plătit", ru: "Отмечен аванс оплачен", uk: "Позначено: аванс оплачено" },
  t_depOff: { en: "Marked deposit unpaid", ro: "Marcat avans neplătit", ru: "Отмечено: аванс не оплачен", uk: "Позначено: аванс не оплачено" },
  t_doneOn: { en: "Marked settled", ro: "Marcat achitat", ru: "Отмечено: закрыт", uk: "Позначено: закрито" },
  t_doneOff: { en: "Marked not settled", ro: "Marcat neachitat", ru: "Отмечено: не закрыт", uk: "Позначено: не закрито" },
  t_sample: { en: "Sample jobs loaded", ro: "Lucrări exemplu încărcate", ru: "Примеры загружены", uk: "Приклади завантажено" },
};

export default function PaymentsPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  const { jobs: allJobs, activeId } = useStudioJobs();
  const [toast, fire] = useToast();
  // Pay records live outside React state (their own localStorage keys), so a
  // write to one doesn't itself trigger a re-render or a memo recompute —
  // `tick` is a real, read dependency (not just the setter, which never
  // changes reference and would silently never invalidate the memo below).
  const [tick, bump] = useState(0);
  useEffect(() => { document.title = "Payments & cashflow | VoltMira"; }, []);

  const activeEur = useMemo(() => jobMoneySummary(client).eur, [client]);
  const rows = useMemo(
    () => allJobs.map((j) => ({ job: j, money: jobMoneySummary(j) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allJobs, tick]
  );

  const patchPay = (jobId, patch) => { setPayRecord(jobId, patch); bump((n) => n + 1); };

  const lei = (e) => NUM(e * FX.MDL) + " lei";
  let received = 0, owed = 0;
  for (const { money } of rows) {
    if (money.depPaid) received += money.dep; else owed += money.dep;
    if (money.done) received += money.bal; else if (money.depPaid) owed += money.bal;
  }
  const committed = 61800; // mock supplier POs outstanding

  function stateOf(money) {
    if (money.done) return ["done", "done"];
    if (!money.depPaid) return ["awaiting", "await"];
    return ["paid", "ok"];      // deposit paid, balance not yet settled
  }

  const gross = activeEur * FX.MDL;
  const netMdl = gross / 1.2, vatMdl = gross - netMdl;

  return (
    <>
      {toast}
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

      {/* jobs ledger — every job from the Studio hub, real deposit/balance from the quote */}
      <div className="pv-panel pv-noprint">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{T(TX.jobs)}</h3>
          <a className="btn ghost sm" href="/studio">{T(TX.addJobLink)}</a>
        </div>

        <div className="pv-tbl-wrap">
          <table className="pv-tbl">
            <thead><tr>
              <th>{T(TX.c_client)}</th><th className="th-r">{T(TX.c_value)}</th>
              <th className="th-r">{T(TX.c_dep)}</th><th className="th-r">{T(TX.c_bal)}</th><th>{T(TX.c_state)}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(({ job, money }) => {
                const [lbl, cls] = stateOf(money);
                const isActive = job.id === activeId;
                return (
                  <tr key={job.id} style={isActive ? { background: "var(--green-tint)" } : undefined}>
                    <td><b>{job.name}</b><div style={{ color: "var(--muted)", fontSize: 11.5 }}>{String(job.address || "").split(",")[0]}</div></td>
                    <td className="num">{lei(money.eur)}</td>
                    <td className="num">{lei(money.dep)}<div style={{ fontSize: 10.5, color: money.depPaid ? "var(--green)" : "var(--muted)" }}>{money.depPaid ? T(TX.paid) : T(TX.awaiting)}</div></td>
                    <td className="num">{money.done ? <span style={{ color: "var(--muted)" }}>—</span> : lei(money.bal)}</td>
                    <td><span className={"pmt-st " + cls}>{T(TX[lbl])}</span></td>
                    <td>
                      <div className="pmt-acts">
                        <button className={"pmt-mini" + (money.depPaid ? " on" : "")} title={T(TX.markPaidDep)}
                          onClick={() => { patchPay(job.id, { depPaid: !money.depPaid }); fire(T(money.depPaid ? TX.t_depOff : TX.t_depOn)); }}>{T(TX.markPaidDep)}</button>
                        <button className={"pmt-mini" + (money.done ? " on" : "")} title={T(TX.markDone)}
                          onClick={() => { patchPay(job.id, { done: !money.done, depPaid: money.done ? money.depPaid : true }); fire(T(money.done ? TX.t_doneOff : TX.t_doneOn)); }}>{T(TX.markDone)}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* fiscal invoice */}
      <DocReveal lang={lang}>
        <div className="pv-doc">
          <div className="doc-co">VoltMira, {new Date().toLocaleDateString(({ ru: "ru-RU", uk: "uk-UA", en: "en-GB" }[lang] || "ro-RO"))}, {tx({ ro: "factură, verificați cu contabilul", en: "invoice, verify with your accountant", ru: "проверьте с бухгалтером", uk: "перевірте з бухгалтером" }, lang)}</div>
          <h1>{T(TX.invoice).toUpperCase()}</h1>
          <div className="doc-grid">
            <div className="doc-kv"><span>{T(TX.invNo)}</span><b>FF-2026-0148</b></div>
            <div className="doc-kv"><span>{T(TX.invClient)}</span><b>{client.name}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Adresă", en: "Address", ru: "Адрес", uk: "Адреса" }, lang)}</span><b>{client.address}</b></div>
            <div className="doc-kv"><span>{tx({ ro: "Nr. contract", en: "Contract no.", ru: "№ договора", uk: "№ договору" }, lang)}</span><b>{client.contractNo}</b></div>
          </div>
          <table>
            <thead><tr><th>{tx({ ro: "Denumire", en: "Description", ru: "Наименование", uk: "Найменування" }, lang)}</th><th style={{ width: 60 }}>{tx({ ro: "Cant.", en: "Qty", ru: "Кол.", uk: "К-сть" }, lang)}</th><th style={{ width: 150 }}>{tx({ ro: "Valoare", en: "Amount", ru: "Сумма", uk: "Сума" }, lang)}</th></tr></thead>
            <tbody>
              <tr><td>{T(TX.invLine)}, {(+client.kw || 0).toFixed(1)} kW{+client.batteryKwh > 0 ? ` + ${client.batteryKwh} kWh` : ""}</td><td>1</td><td>{NUM(netMdl)} lei</td></tr>
            </tbody>
          </table>
          <div className="doc-grid" style={{ maxWidth: 320, marginLeft: "auto" }}>
            <div className="doc-kv"><span>{T(TX.invNet)}</span><b>{NUM(netMdl)} lei</b></div>
            <div className="doc-kv"><span>{T(TX.invVat)}</span><b>{NUM(vatMdl)} lei</b></div>
            <div className="doc-kv"><span>{T(TX.invTot)}</span><b>{NUM(gross)} lei</b></div>
          </div>
          <p className="doc-note">{tx({ ro: `Echivalent €${NUM(activeEur)} la cursul BNM. Plata prin transfer în contul din antet, ref. FF-2026-0148.`, en: `€${NUM(activeEur)} equivalent at the BNM rate. Payment by transfer to the account in the header, ref. FF-2026-0148.`, ru: `Эквивалент €${NUM(activeEur)} по курсу BNM. Оплата переводом на счёт в шапке, реф. FF-2026-0148.`, uk: `Еквівалент €${NUM(activeEur)} за курсом BNM. Оплата переказом на рахунок у шапці, реф. FF-2026-0148.` }, lang)}</p>
        </div>
      </DocReveal>

      <style dangerouslySetInnerHTML={{ __html: `
        .pmt-st{font-family:var(--font-m,monospace);font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
          border-radius:99px;padding:3px 9px}
        .pmt-st.ok{background:var(--green-tint);color:var(--green)}
        .pmt-st.done{background:var(--green-tint);color:var(--green)}
        .pmt-st.due{background:var(--amber-tint);color:#B4700F}
        .pmt-st.await{background:var(--paper);border:1px solid var(--line);color:var(--muted)}
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
