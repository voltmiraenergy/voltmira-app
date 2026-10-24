"use client";
// app/estimate/[slug]/EstimateForm.jsx — the visitor's side of an installer's estimate page, styled like the client
// offer (estimate.css): the cover with the address and the bill (or the monthly kWh) beside it; a real estimate from
// /api/estimate (the same engine as the installer's quotes) in its place; then the production month by month, the
// house from above, what systems nearby really produce, and the request for the full proposal (/api/estimate-lead).
// The page also lives in an <iframe> on the installer's own site, so it carries no app stylesheet and imports only
// small text files.
import { useEffect, useRef, useState } from "react";
import { Calculator, HeartHandshake, MapPin, Sun } from "lucide-react";
import { et, PHONE_EXAMPLE } from "../../../lib/estimateText.js";
import { moneyFormatter, numFor } from "../../../lib/money.js";
import { yearsN, kwhUnit, kwUnit } from "../../p/[code]/text.js";
import RoofSatellite from "../../../components/RoofSatellite.jsx";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const CURRENCY = { MD: "MDL", RO: "RON", UA: "UAH" };
const ERR = { no_address: "err_address", not_found: "err_not_found", rate: "err_rate", upstream: "err_upstream" };

export default function EstimateForm({ slug, lang, langs = [], market = "MD", company, embed = false }) {
  const cur = CURRENCY[market] || "EUR";
  const num = numFor(lang);
  const money = (eur, currency) => moneyFormatter({ currency: currency || cur, lang })(eur);
  const co = company.name;

  const [address, setAddress] = useState("");
  const [by, setBy] = useState("bill");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);

  const [f, setF] = useState({ name: "", phone: "", email: "", message: "", timeline: "", wantsFinancing: false, consent: false, website: "" });
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const nameRef = useRef(null);

  // ---- Turnstile, once the request form shows
  const tsRef = useRef(null), tsWidget = useRef(null), tsToken = useRef("");
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !res || sent) return;
    function render() {
      if (!tsRef.current || tsWidget.current !== null || !window.turnstile) return;
      tsWidget.current = window.turnstile.render(tsRef.current, {
        sitekey: TURNSTILE_SITE_KEY, language: lang, theme: "light",
        callback: (tok) => { tsToken.current = tok; },
        "expired-callback": () => { tsToken.current = ""; },
        "error-callback": () => { tsToken.current = ""; },
      });
    }
    if (window.turnstile) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = render;
    document.head.appendChild(s);
    return () => { tsWidget.current = null; };
  }, [res, sent, lang]);

  async function calculate(e) {
    e.preventDefault();
    if (!address.trim()) { setErr(et("err_address", lang)); return; }
    setBusy(true); setErr(""); setRes(null);
    try {
      const qs = new URLSearchParams({ address, country: market });
      if (amount) qs.set(by === "kwh" ? "kwh" : "bill", amount);
      const r = await fetch(`/api/estimate?${qs}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.error) setErr(et(ERR[d?.error] || "err_upstream", lang));
      else setRes(d);
    } catch {
      setErr(et("err_upstream", lang));
    } finally {
      setBusy(false);
    }
  }

  function toRequest() {
    document.getElementById("ep-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 400);
  }

  async function send(e) {
    e.preventDefault();
    setSendErr("");
    if (!f.consent) { setSendErr(et("err_consent", lang)); return; }
    setSending(true);
    try {
      const r = await fetch("/api/estimate-lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, ...f, timeline: f.timeline || null, address, lang,
          ...(by === "kwh" ? { kwh: amount } : { bill: amount }), token: tsToken.current,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setSent(true); return; }
      const field = (d.fields || [])[0];
      setSendErr(
        d.error === "captcha" ? et("err_captcha", lang)
          : d.error === "rate" ? et("err_rate", lang)
          : field === "phone" ? et("err_phone", lang, { country: et("country_" + market, lang), example: PHONE_EXAMPLE[market] || PHONE_EXAMPLE.MD })
          : field ? et("err_" + field, lang)
          : et("err", lang));
      if (TURNSTILE_SITE_KEY && window.turnstile && tsWidget.current !== null) { try { window.turnstile.reset(tsWidget.current); } catch {} tsToken.current = ""; }
    } catch {
      setSendErr(et("err", lang));
    } finally {
      setSending(false);
    }
  }

  const pb = res?.payback || {};
  const yrs = (v) => yearsN(Math.round(v * 10) / 10, lang);
  const range = pb.opti != null && pb.pess != null && pb.pess > pb.opti ? et("res_payback_range", lang, { a: yrs(pb.opti), b: yrs(pb.pess) }) : null;
  const showSat = res && res.precision && res.precision !== "area" && Number.isFinite(res.lat) && Number.isFinite(res.lon);
  const consMonth = res?.annualConsKwh > 0 ? res.annualConsKwh / 12 : 0;

  return (
    <div className="ep-wrap">
      <header className="ep-hero">
        <div className="ep-hero-copy">
          <div className="ep-brand">
            <div className="ep-brand-id">
              {company.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <span className="ep-logo"><img src={company.logo} alt={co} /></span>
                : <span className="ep-mono" aria-hidden="true">{co.trim().charAt(0).toUpperCase()}</span>}
              {!company.logo && <span className="ep-co">{co}</span>}
            </div>
            {!embed && langs.length > 1 && (
              <nav className="ep-langs" aria-label={et("lang_label", lang)}>
                {langs.map(({ l, href }) => (
                  <a key={l} href={href} hrefLang={l} lang={l} aria-current={l === lang ? "true" : undefined}>{l}</a>
                ))}
              </nav>
            )}
          </div>
          <h1 className="ep-h1">{et("title", lang)}</h1>
          <p className="ep-sub">{et("sub", lang)}</p>
          {!embed && (
            <ul className="ep-facts">
              <li><Sun className="ep-ic" aria-hidden="true" />{et("fact_sun", lang)}</li>
              <li><Calculator className="ep-ic" aria-hidden="true" />{et("fact_same", lang, { co })}</li>
              <li><HeartHandshake className="ep-ic" aria-hidden="true" />{et("fact_free", lang)}</li>
            </ul>
          )}
        </div>

        <section className="ep-panel" aria-live="polite" aria-labelledby="ep-panel-h">
          {!res ? (
            <form onSubmit={calculate} noValidate>
              <h2 className="ep-panel-h" id="ep-panel-h">{et("form_h", lang)}</h2>
              <div className="ep-field">
                <label className="ep-label" htmlFor="est-addr">{et("addr", lang)}</label>
                <input id="est-addr" className="ep-input" value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder={et("addr_ph", lang)} autoComplete="street-address" required />
              </div>
              <div className="ep-seg" role="radiogroup" aria-label={et("by", lang)}>
                {["bill", "kwh"].map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={by === k} onClick={() => setBy(k)}>
                    {et("by", lang)} {et(k === "bill" ? "by_bill" : "by_kwh", lang)}
                  </button>
                ))}
              </div>
              <div className="ep-field">
                <label className="ep-label" htmlFor="est-amount">
                  {by === "bill" ? et("bill_label", lang, { cur }) : et("kwh_label", lang, { unit: kwhUnit(lang) })}
                </label>
                <input id="est-amount" className="ep-input ep-num" type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              {err && <p className="ep-err" role="alert">{err}</p>}
              <button type="submit" className="ep-btn ep-btn-key ep-btn-block" disabled={busy} aria-busy={busy}>
                {busy ? et("calculating", lang) : et("calc", lang)}
              </button>
            </form>
          ) : (
            <div>
              <h2 className="ep-panel-h" id="ep-panel-h">{et("form_h", lang)}</h2>
              {res.location && <p className="ep-for"><MapPin className="ep-ic" aria-hidden="true" />{et("res_for", lang, { place: res.location })}</p>}
              {res.savingsMonthly && (
                <>
                  <span className="ep-big-k">{et("res_save", lang)}</span>
                  <b className="ep-big ep-num">{money(res.savingsMonthly.eur, res.currency)}</b>
                  {res.annualSavings && <span className="ep-big-note ep-num">{et("res_year", lang)}: {money(res.annualSavings.eur, res.currency)}</span>}
                </>
              )}
              <dl className="ep-rows">
                <Row k={et("res_kw", lang)} v={`${num(res.recommendedKw, 1)} ${kwUnit(lang)}`} />
                <Row k={et("res_prod", lang)} v={`${num(res.prodKwh, 0)} ${kwhUnit(lang)}`} />
                <Row k={et("res_price", lang)} v={money(res.cost.eur, res.currency)} />
                {res.monthly && <Row k={et("res_monthly", lang)} v={money(res.monthly.eur, res.currency)}
                  note={et("res_monthly_note", lang, { y: res.monthly.years, r: num(res.monthly.ratePct, 1) })} />}
                <Row k={et("res_payback", lang)} v={pb.expc == null ? yearsN(25, lang) : yrs(pb.expc)}
                  note={range ? `${range}, ${et("res_payback_note", lang)}` : null} />
              </dl>
              <div className="ep-actions">
                {!sent && <button type="button" className="ep-btn ep-btn-key ep-btn-block" onClick={toRequest}>{et("cta_go", lang)}</button>}
                <button type="button" className="ep-btn ep-btn-text" onClick={() => setRes(null)}>{et("recalc", lang)}</button>
              </div>
              <p className="ep-note">{et("res_note", lang, { co })}</p>
            </div>
          )}
        </section>
      </header>

      {res && (
        <section className="ep-sec" aria-labelledby="ep-months-h">
          <h2 className="ep-h2" id="ep-months-h">{et("months_h", lang)}</h2>
          <p className="ep-lead">{et("months_p", lang)}</p>
          <div className={showSat ? "ep-two" : undefined}>
            <figure className="ep-card ep-chart">
              <div className="ep-keys">
                <span className="ep-key"><i className="ep-sw" style={{ background: "#1F7A55" }} aria-hidden="true" />{et("months_prod", lang)}</span>
                {consMonth > 0 && <span className="ep-key"><i className="ep-sw is-line" aria-hidden="true" />{et("months_cons", lang)}</span>}
              </div>
              <div className="ep-cw"><MonthBars prod={res.monthlyKwh || []} cons={consMonth} lang={lang} title={et("months_title", lang, { u: kwhUnit(lang) })} /></div>
              <div className="ep-cn"><MonthBars prod={res.monthlyKwh || []} cons={consMonth} lang={lang} narrow title={et("months_title", lang, { u: kwhUnit(lang) })} /></div>
            </figure>
            {showSat && (
              <figure className="ep-card ep-sat">
                <RoofSatellite roof={{ planes: [], center: { lat: res.lat, lon: res.lon, approx: res.precision !== "house" }, tileZoom: 18 }} width={640} height={420} />
                <figcaption>
                  <b>{et(res.precision === "house" ? "sat_house" : "sat_street", lang)}</b>
                  {et("sat_note", lang, { co })}
                </figcaption>
              </figure>
            )}
          </div>
          {res.nearby && (
            <div className="ep-card ep-near">
              <h3 className="ep-h3">{et("near_h", lang)}</h3>
              <p>{et("near_body", lang, { d: res.nearby.name?.[lang] || res.nearby.name?.ro || res.nearby.district, n: res.nearby.systems, y: num(res.nearby.kwhPerKwp, 0), u: kwhUnit(lang) })}</p>
              {res.yieldPerKwp > 0 && <p>{et("near_own", lang, { y: num(res.yieldPerKwp, 0), u: kwhUnit(lang) })}</p>}
              <small>{et("near_src", lang)}</small>
            </div>
          )}
        </section>
      )}

      {res && (
        <section className="ep-sec" id="ep-request" aria-labelledby="ep-req-h">
          {sent ? (
            <div className="ep-card ep-done" role="status">
              <h2 className="ep-h2" id="ep-req-h">{et("thanks_h", lang)}</h2>
              <p>{et("thanks", lang, { co })}</p>
            </div>
          ) : (
            <div className="ep-req">
              <div>
                <h2 className="ep-h2" id="ep-req-h">{et("cta_h", lang, { co })}</h2>
                <p className="ep-lead">{et("cta_p", lang, { co })}</p>
              </div>
              <form className="ep-card ep-req-form" onSubmit={send} noValidate>
                <div className="ep-req-grid">
                  <div className="ep-field">
                    <label className="ep-label" htmlFor="est-name">{et("name", lang)}</label>
                    <input id="est-name" ref={nameRef} className="ep-input" value={f.name} onChange={set("name")} autoComplete="name" required />
                  </div>
                  <div className="ep-field">
                    <label className="ep-label" htmlFor="est-phone">{et("phone", lang)}</label>
                    <input id="est-phone" className="ep-input" type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel"
                      placeholder={PHONE_EXAMPLE[market] || PHONE_EXAMPLE.MD} required />
                  </div>
                </div>
                <div className="ep-field">
                  <label className="ep-label" htmlFor="est-email">{et("email", lang)}</label>
                  <input id="est-email" className="ep-input" type="email" value={f.email} onChange={set("email")} autoComplete="email" />
                </div>
                <fieldset className="ep-choices">
                  <legend className="ep-label">{et("when_q", lang)}</legend>
                  <div className="ep-chips">
                    {["now", "soon", "later"].map((w) => (
                      <label key={w} className="ep-chip">
                        <input type="radio" name="est-when" value={w} checked={f.timeline === w} onChange={set("timeline")} />
                        <span>{et("when_" + w, lang)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="ep-check">
                  <input type="checkbox" checked={f.wantsFinancing} onChange={set("wantsFinancing")} />
                  <span>{et("fin", lang)}</span>
                </label>
                <div className="ep-field">
                  <label className="ep-label" htmlFor="est-msg">{et("msg", lang)}</label>
                  <textarea id="est-msg" className="ep-input" value={f.message} onChange={set("message")} maxLength={500} />
                </div>
                {/* the honeypot: people never see it, bots fill it */}
                <input className="ep-hp" aria-hidden="true" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
                <label className="ep-check is-small">
                  <input type="checkbox" checked={f.consent} onChange={set("consent")} required />
                  <span>
                    {et("consent", lang, { co })}{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">{et("privacy", lang)}</a>
                  </span>
                </label>
                {TURNSTILE_SITE_KEY && <div ref={tsRef} style={{ margin: "0 0 14px" }} />}
                {sendErr && <p className="ep-err" role="alert">{sendErr}</p>}
                <button type="submit" className="ep-btn ep-btn-key ep-btn-block" disabled={sending} aria-busy={sending}>
                  {sending ? et("sending", lang) : et("send", lang)}
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {!embed && (
        <section className="ep-sec" aria-labelledby="ep-steps-h">
          <h2 className="ep-h2" id="ep-steps-h">{et("steps_h", lang)}</h2>
          <ol className="ep-steps">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="ep-card ep-step">
                <h3 className="ep-h3">{et(`step${n}_h`, lang)}</h3>
                <p>{et(`step${n}`, lang, { co })}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="ep-foot">
        <span>{et("powered", lang)}</span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer">{et("privacy", lang)}</a>
      </footer>
    </div>
  );
}

function Row({ k, v, note }) {
  return (
    <div className="ep-row">
      <dt>{k}{note && <small>{note}</small>}</dt>
      <dd className="ep-num">{v}</dd>
    </div>
  );
}

// Short month names in the reader's language, without the trailing dot (as the offer's charts write them).
const LOCS = { en: "en-US", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
function monthNames(lang) {
  const f = new Intl.DateTimeFormat(LOCS[lang] || "en-US", { month: "short", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2026, i, 15))).replace(/\.$/, ""));
}
// A 1 / 2 / 5 x 10^n step, so the axis lands on figures people read.
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
}

/** Production per month as bars, the monthly use as one dashed line. Colours as the offer's chart (charts.jsx). */
function MonthBars({ prod, cons, lang, narrow = false, title = "" }) {
  if (prod.length !== 12) return null;
  const [W, H, L, R, T, B] = narrow ? [360, 220, 40, 6, 12, 24] : [560, 250, 46, 8, 14, 28];
  const FS = narrow ? 10.5 : 12.5;
  const maxV = Math.max(...prod, cons || 0, 1);
  const step = niceStep(maxV / 3);
  const hi = Math.ceil(maxV / step) * step;
  const slot = (W - L - R) / 12;
  const bar = Math.min(narrow ? 16 : 30, slot * 0.62);
  const Y = (v) => T + (1 - v / hi) * (H - T - B);
  const ticks = [];
  for (let v = 0; v <= hi + 1e-9; v += step) ticks.push(v);
  const months = monthNames(lang);
  const loc = LOCS[lang] || "en-US";
  const n0 = (v) => Math.round(v).toLocaleString(loc);
  const unit = kwhUnit(lang);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title || undefined}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke="#E3E1D6" strokeWidth="1" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={FS} fill="#5D6B62" style={{ fontVariantNumeric: "tabular-nums" }}>{n0(v)}</text>
        </g>
      ))}
      {prod.map((p, i) => {
        const x = L + slot * i + (slot - bar) / 2;
        return (
          <g key={i}>
            <rect x={x} y={Y(p)} width={bar} height={Math.max(0, Y(0) - Y(p))} rx="3" fill="#1F7A55">
              <title>{`${months[i]}: ${n0(p)} ${unit}`}</title>
            </rect>
            <text x={x + bar / 2} y={H - 7} textAnchor="middle" fontSize={FS} fill="#5D6B62">{narrow ? months[i].slice(0, 1).toUpperCase() : months[i]}</text>
          </g>
        );
      })}
      {cons > 0 && <line x1={L} y1={Y(cons)} x2={W - R} y2={Y(cons)} stroke="#B88746" strokeWidth="2" strokeDasharray="6 4" />}
    </svg>
  );
}
