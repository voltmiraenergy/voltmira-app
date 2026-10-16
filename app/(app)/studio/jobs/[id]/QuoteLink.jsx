"use client";
// app/(app)/studio/jobs/[id]/QuoteLink.jsx — the job's quote: link one of the
// company's quotes, or make one from this job, so the same client is not in
// two places (lib/studioLink.js). Once linked: the quote's name, a way to
// open it, a note when the two system sizes differ, and unlinking.
import { useEffect, useState } from "react";
import Link from "next/link";
import { tx } from "../../studio-kit.jsx";
import { quotesForLink, quoteSummary, createQuoteFromJob } from "../../../../../lib/studioLink.js";

const T = {
  h: { en: "Quote", ro: "Oferta", ru: "КП", uk: "Пропозиція" },
  none: { en: "This job has no quote yet. Link the client's quote, or make one from this job's client, address and system.", ro: "Lucrarea nu are încă o ofertă. Leagă oferta clientului sau creeaz-o din clientul, adresa și sistemul acestei lucrări.", ru: "У объекта ещё нет КП. Свяжите КП клиента или создайте его из клиента, адреса и системы объекта.", uk: "Об’єкт ще не має пропозиції. Зв’яжіть пропозицію клієнта або створіть її з клієнта, адреси та системи об’єкта." },
  create: { en: "Make a quote from this job", ro: "Creează o ofertă din lucrare", ru: "Создать КП из объекта", uk: "Створити пропозицію з об’єкта" },
  creating: { en: "Making the quote...", ro: "Se creează oferta...", ru: "Создаём КП...", uk: "Створюємо пропозицію..." },
  pick: { en: "Or link an existing quote", ro: "Sau leagă o ofertă existentă", ru: "Или свяжите существующее КП", uk: "Або зв’яжіть наявну пропозицію" },
  choose: { en: "Choose a quote", ro: "Alege o ofertă", ru: "Выберите КП", uk: "Оберіть пропозицію" },
  link: { en: "Link", ro: "Leagă", ru: "Связать", uk: "Зв’язати" },
  open: { en: "Open the quote", ro: "Deschide oferta", ru: "Открыть КП", uk: "Відкрити пропозицію" },
  unlink: { en: "Unlink", ro: "Dezleagă", ru: "Отвязать", uk: "Відв’язати" },
  differs: { en: "The quote is {q} kW and this job {j} kW: one of them needs updating.", ro: "Oferta are {q} kW, iar lucrarea {j} kW: una dintre ele trebuie actualizată.", ru: "В КП {q} кВт, в объекте {j} кВт: одно из них нужно обновить.", uk: "У пропозиції {q} кВт, в об’єкті {j} кВт: одне з них треба оновити." },
  gone: { en: "The linked quote is no longer there.", ro: "Oferta legată nu mai există.", ru: "Связанного КП больше нет.", uk: "Пов’язаної пропозиції більше немає." },
  failed: { en: "It did not work. Try again.", ro: "Nu a mers. Încearcă din nou.", ru: "Не получилось. Попробуйте снова.", uk: "Не вдалося. Спробуйте ще раз." },
};

export default function QuoteLink({ job, lang, onLink }) {
  const t = (o, v = {}) => tx(o, lang).replace(/\{(\w+)\}/g, (m, k) => (v[k] == null ? m : v[k]));
  const [quote, setQuote] = useState(undefined);     // undefined loading, null none/gone, object linked
  const [list, setList] = useState([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (job.projectId) quoteSummary(job.projectId).then((q) => { if (alive) setQuote(q); }).catch(() => alive && setQuote(null));
    else quotesForLink().then((l) => { if (alive) { setList(l); setQuote(null); } }).catch(() => alive && setQuote(null));
    return () => { alive = false; };
  }, [job.projectId]);

  const make = async () => {
    setBusy(true); setFailed(false);
    try { onLink(await createQuoteFromJob(job)); } catch { setFailed(true); } finally { setBusy(false); }
  };

  if (quote === undefined) return null;
  return (
    <div className="pv-panel">
      <h3>{t(T.h)}</h3>
      {job.projectId && quote ? (
        <>
          <p style={{ margin: "0 0 10px" }}><b>{quote.title || quote.client}</b>{quote.client && quote.title !== quote.client ? `, ${quote.client}` : ""}, {quote.kw.toFixed(1)} kW</p>
          {Math.abs(quote.kw - (+job.kw || 0)) > 0.05 && <p className="pv-warn" style={{ margin: "0 0 10px" }}>{t(T.differs, { q: quote.kw.toFixed(1), j: (+job.kw || 0).toFixed(1) })}</p>}
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: 0 }}>
            <Link href={`/projects/${quote.id}`} className="btn primary sm">{t(T.open)}</Link>
            <button type="button" className="btn ghost sm" onClick={() => onLink(null)}>{t(T.unlink)}</button>
          </p>
        </>
      ) : (
        <>
          {job.projectId && <p className="pv-warn" style={{ margin: "0 0 10px" }}>{t(T.gone)}</p>}
          <p style={{ margin: "0 0 10px" }}>{t(T.none)}</p>
          <button type="button" className="btn primary sm" disabled={busy} onClick={make}>{busy ? t(T.creating) : t(T.create)}</button>
          {list.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <label htmlFor={`ql-${job.id}`} style={{ fontSize: 13, color: "var(--muted)" }}>{t(T.pick)}</label>
              <select id={`ql-${job.id}`} className="pv-input" style={{ maxWidth: 320 }} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{t(T.choose)}</option>
                {list.map((q) => <option key={q.id} value={q.id}>{[q.title, q.client, `${q.kw.toFixed(1)} kW`].filter(Boolean).join(", ")}</option>)}
              </select>
              <button type="button" className="btn ghost sm" disabled={!pick} onClick={() => onLink(pick)}>{t(T.link)}</button>
            </div>
          )}
          {failed && <p className="pv-warn" role="alert" style={{ margin: "10px 0 0" }}>{t(T.failed)}</p>}
        </>
      )}
    </div>
  );
}
