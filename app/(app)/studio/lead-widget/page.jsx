"use client";
// Preview 6 — Public calculator widget.
// The homeowner-facing calculator an installer embeds on their own site, in
// Romanian or Russian. Address + monthly bill → an honest production range and a
// price band from the live engine → a lead that lands in the VoltMira pipeline.
// Mock leads and stats; the maths is the real @voltmira/engine.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM,
  CopyButton, engineSettings,
} from "../studio-kit.jsx";
import { quote, FX } from "../_engine.js";

const TX = {
  title: { en: "Public calculator widget", ro: "Widget calculator public", ru: "Публичный калькулятор" },
  sub: {
    en: "The homeowner calculator you embed on your own site — Romanian or Russian. Every estimate becomes a lead in your VoltMira pipeline.",
    ro: "Calculatorul pentru proprietari pe care îl pui pe site-ul tău — în română sau rusă. Fiecare estimare devine un lead în fluxul tău VoltMira.",
    ru: "Калькулятор для домовладельцев, который вы встраиваете на свой сайт — на румынском или русском. Каждая оценка становится лидом в вашей воронке VoltMira.",
  },
  note: {
    en: "The panel on the left is the embedded widget as a visitor sees it. Try it — the range and price come from the engine, and a submitted request lands in your Leads.",
    ro: "Panoul din stânga este widgetul încorporat, așa cum îl vede un vizitator. Încearcă-l — intervalul și prețul vin din motor, iar o cerere trimisă ajunge în Contacte.",
    ru: "Панель слева — встроенный виджет, каким его видит посетитель. Попробуйте — диапазон и цена из движка, а отправленная заявка попадает в «Заявки».",
  },
  leads: { en: "Leads in VoltMira", ro: "Lead-uri în VoltMira", ru: "Лиды в VoltMira" },
  embed: { en: "Embed code", ro: "Cod de încorporare", ru: "Код для вставки" },
  stats30: { en: "Last 30 days", ro: "Ultimele 30 de zile", ru: "Последние 30 дней" },
  impressions: { en: "impressions", ro: "afișări", ru: "показы" },
  estimates: { en: "estimates", ro: "estimări", ru: "оценки" },
  leadsN: { en: "leads", ro: "lead-uri", ru: "лиды" },
  rate: { en: "estimate → lead", ro: "estimare → lead", ru: "оценка → лид" },
  source: { en: "widget · own site", ro: "widget · site propriu", ru: "виджет · свой сайт" },
  justNow: { en: "just now", ro: "acum", ru: "только что" },
};

// Widget-facing copy is Romanian / Russian only — it's shown to MD homeowners.
const W = {
  ro: {
    brand: "Calculator solar", headline: "Cât economisești cu panouri solare?",
    addr: "Localitate sau adresă", bill: "Factura lunară la curent (MDL)", roof: "Acoperiș",
    pitched: "Înclinat", flat: "Terasă", calc: "Calculează",
    sys: "Sistem recomandat", prod: "Producție anuală estimată", price: "Preț sistem, la cheie",
    payback: "Amortizare", save25: "Economie estimată pe 25 de ani", years: "ani",
    cta: "Cere o ofertă detaliată", name: "Nume", phone: "Telefon", send: "Trimite cererea",
    sent: "Cerere trimisă — te contactăm în curând.",
    disc: "Estimare orientativă pe baza datelor introduse. Oferta finală depinde de vizita tehnică.",
  },
  ru: {
    brand: "Солнечный калькулятор", headline: "Сколько вы сэкономите с солнечными панелями?",
    addr: "Населённый пункт или адрес", bill: "Счёт за электричество в месяц (MDL)", roof: "Крыша",
    pitched: "Скатная", flat: "Плоская", calc: "Рассчитать",
    sys: "Рекомендуемая система", prod: "Ожидаемая выработка в год", price: "Стоимость системы, под ключ",
    payback: "Окупаемость", save25: "Экономия за 25 лет", years: "лет",
    cta: "Запросить подробное предложение", name: "Имя", phone: "Телефон", send: "Отправить заявку",
    sent: "Заявка отправлена — скоро свяжемся.",
    disc: "Ориентировочный расчёт по введённым данным. Итоговое предложение — после технического визита.",
  },
};

const SEED_LEADS = [
  { name: "Andrei M.", loc: "Ialoveni", kw: 5.5, ago: { ro: "acum 2 ore", en: "2 h ago", ru: "2 ч назад" } },
  { name: "Elena R.", loc: "Chișinău, Botanica", kw: 8, ago: { ro: "acum 5 ore", en: "5 h ago", ru: "5 ч назад" } },
  { name: "Игорь П.", loc: "Bălți", kw: 6.5, ago: { ro: "ieri", en: "yesterday", ru: "вчера" } },
  { name: "Vasile C.", loc: "Strășeni", kw: 10, ago: { ro: "ieri", en: "yesterday", ru: "вчера" } },
];

const MDL = (eur) => NUM(Math.round(eur * FX.MDL)) + " MDL";

export default function LeadWidgetPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  useEffect(() => { document.title = "Public calculator widget — VoltMira Studio"; }, []);

  const [wl, setWl] = useState(lang === "ru" ? "ru" : "ro");
  useEffect(() => { setWl(lang === "ru" ? "ru" : "ro"); }, [lang]);
  const w = W[wl];

  const [addr, setAddr] = useState("Chișinău");
  const [bill, setBill] = useState(1400);
  const [roof, setRoof] = useState("pitched");
  const [shown, setShown] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [leads, setLeads] = useState(SEED_LEADS);

  const est = useMemo(() => {
    const E = engineSettings();
    const price = 0.185;
    const annualCostEur = (Math.max(200, +bill || 0) * 12) / FX.MDL;
    const annualKwh = annualCostEur / price;
    const rawKw = annualKwh / 1180;
    const kw = Math.min(10, Math.max(2, Math.round(rawKw * 2) / 2));
    const project = {
      market: "MD", kw, price, cons: Math.round(annualKwh), batt: false, battKwh: 0,
      yieldOverride: roof === "flat" ? 1120 : 1180,
    };
    const q = quote(project, E);
    const life = q.e.rows[q.e.rows.length - 1] + q.e.cost; // gross 25-yr savings, EUR
    return {
      kw,
      prodLo: q.p.prod0, prodHi: q.e.prod0,
      priceLo: q.e.grossCost * 0.92, priceHi: q.e.grossCost * 1.08,
      paybackLo: q.e.payback, paybackHi: q.p.payback,
      life,
    };
  }, [bill, roof]);

  function submit(e) {
    e.preventDefault();
    setLeads((L) => [{ name: name.trim() || "Client nou", loc: addr, kw: est.kw, ago: TX.justNow, fresh: true }, ...L].slice(0, 6));
    setSent(true);
    setName(""); setPhone("");
    setTimeout(() => setSent(false), 3200);
  }

  const pb = (v) => (v == null ? "25+" : v.toFixed(1));

  return (
    <>
      <PreviewHeader slug="lead-widget" lang={lang} title={T(TX.title)} sub={T(TX.sub)} />
      <MockNote>{T(TX.note)}</MockNote>

      <div className="lw-grid">
        {/* the embedded widget as a visitor sees it */}
        <div className="lw-frame">
          <div className="lw-fbar">
            <span className="lw-brand">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M5 19 8.6 9M10.6 19 15 6M16 19 19.4 8" /><circle cx="15" cy="6" r="1.6" fill="currentColor" stroke="none" /></svg>
              {w.brand}
            </span>
            <div className="pv-seg lw-lang">
              <button className={wl === "ro" ? "on" : ""} onClick={() => setWl("ro")}>RO</button>
              <button className={wl === "ru" ? "on" : ""} onClick={() => setWl("ru")}>RU</button>
            </div>
          </div>

          <div className="lw-body">
            <p className="lw-headline">{w.headline}</p>

            <label className="lw-field"><span>{w.addr}</span>
              <input className="pv-input" value={addr} onChange={(e) => setAddr(e.target.value)} /></label>
            <label className="lw-field"><span>{w.bill}</span>
              <input className="pv-input" type="number" min="0" step="50" value={bill} onChange={(e) => setBill(+e.target.value || 0)} /></label>
            <label className="lw-field"><span>{w.roof}</span>
              <div className="pv-seg">
                <button className={roof === "pitched" ? "on" : ""} onClick={() => setRoof("pitched")}>{w.pitched}</button>
                <button className={roof === "flat" ? "on" : ""} onClick={() => setRoof("flat")}>{w.flat}</button>
              </div>
            </label>

            <button className="btn lw-calc" onClick={() => setShown(true)}>{w.calc}</button>

            {shown && (
              <div className="lw-out">
                <div className="lw-out-row"><span>{w.sys}</span><b>{est.kw.toFixed(1)} kW</b></div>
                <div className="lw-out-row"><span>{w.prod}</span><b>{NUM(est.prodLo)}–{NUM(est.prodHi)} kWh</b></div>
                <div className="lw-out-row"><span>{w.price}</span><b>{MDL(est.priceLo)} – {MDL(est.priceHi)}</b></div>
                <div className="lw-out-row"><span>{w.payback}</span><b>{pb(est.paybackLo)}–{pb(est.paybackHi)} {w.years}</b></div>
                <div className="lw-out-row hl"><span>{w.save25}</span><b>{MDL(est.life)}</b></div>

                <form className="lw-cta" onSubmit={submit}>
                  <div className="lw-cta-t">{w.cta}</div>
                  <div className="lw-cta-row">
                    <input className="pv-input" placeholder={w.name} value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="pv-input" placeholder={w.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <button className="btn lw-send" type="submit">{w.send}</button>
                  {sent && <div className="lw-sent">{w.sent}</div>}
                </form>

                <p className="lw-disc">{w.disc}</p>
              </div>
            )}
          </div>
        </div>

        {/* installer side */}
        <div className="lw-aside">
          <div className="pv-panel">
            <h3>{T(TX.leads)}</h3>
            <ul className="lw-leads">
              {leads.map((l, i) => (
                <li key={i} className={l.fresh ? "fresh" : ""}>
                  <div className="lw-lead-t"><b>{l.name}</b><span>{tx(l.ago, lang)}</span></div>
                  <div className="lw-lead-m">{l.loc} · {(+l.kw).toFixed(1)} kW · {T(TX.source)}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="pv-panel">
            <h3>{T(TX.embed)}</h3>
            <pre className="pv-code">{`<script src="https://widget.voltmira.md/v1.js"
  data-installer="solartech"
  data-lang="ro" async></script>
<div id="voltmira-calc"></div>`}</pre>
            <div style={{ marginTop: 10 }}>
              <CopyButton
                text={`<script src="https://widget.voltmira.md/v1.js" data-installer="solartech" data-lang="ro" async></script>\n<div id="voltmira-calc"></div>`}
                label={tx({ en: "Copy snippet", ro: "Copiază codul", ru: "Скопировать код" }, lang)}
                done={tx({ en: "Copied ✓", ro: "Copiat ✓", ru: "Скопировано ✓" }, lang)} />
            </div>
          </div>

          <div className="pv-panel">
            <h3>{T(TX.stats30)}</h3>
            <div className="pv-metrics">
              <div className="pv-metric"><b>1 240</b><span>{T(TX.impressions)}</span></div>
              <div className="pv-metric"><b>88</b><span>{T(TX.estimates)}</span></div>
              <div className="pv-metric good"><b>14</b><span>{T(TX.leadsN)}</span></div>
              <div className="pv-metric"><b>15.9%</b><span>{T(TX.rate)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .lw-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
        @media(max-width:900px){.lw-grid{grid-template-columns:minmax(0,1fr)}}
        .lw-frame{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--paper-2);box-shadow:var(--shadow)}
        .lw-fbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;
          background:var(--paper);border-bottom:1px solid var(--line)}
        .lw-brand{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--ink)}
        .lw-brand svg{color:var(--green)}
        .lw-lang button{padding:5px 9px;font-size:11.5px}
        .lw-body{padding:20px}
        .lw-headline{font-size:17px;font-weight:700;letter-spacing:-.01em;color:var(--ink);margin:0 0 16px;line-height:1.3}
        .lw-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:13px}
        .lw-calc{width:100%;justify-content:center;margin-top:2px}
        .lw-out{margin-top:18px;border-top:1px solid var(--line);padding-top:16px}
        .lw-out-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:7px 0;font-size:13px;color:var(--muted)}
        .lw-out-row b{color:var(--ink);font-weight:700;font-family:var(--font-d);text-align:right}
        .lw-out-row.hl{border-top:1px solid var(--line);margin-top:5px;padding-top:12px}
        .lw-out-row.hl b{color:var(--green);font-size:15px}
        .lw-cta{margin-top:16px;background:var(--green-tint);border-radius:12px;padding:14px}
        .lw-cta-t{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px}
        .lw-cta-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
        @media(max-width:460px){.lw-cta-row{grid-template-columns:1fr}}
        .lw-send{width:100%;justify-content:center}
        .lw-sent{margin-top:9px;font-size:12px;font-weight:600;color:var(--green);text-align:center}
        .lw-disc{margin:12px 0 0;font-size:10.5px;color:var(--muted);line-height:1.5}
        .lw-aside{display:grid;gap:16px}
        .lw-aside .pv-panel + .pv-panel{margin-top:0}
        .lw-leads{list-style:none;margin:0;padding:0;display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
        .lw-leads li{background:var(--paper-2);padding:11px 13px}
        .lw-leads li.fresh{background:var(--green-tint)}
        .lw-lead-t{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
        .lw-lead-t b{font-size:13px;font-weight:700;color:var(--ink)}
        .lw-lead-t span{font-size:11px;color:var(--muted)}
        .lw-lead-m{font-size:11.5px;color:var(--muted);margin-top:3px}
      ` }} />
    </>
  );
}
