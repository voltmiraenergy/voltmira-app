"use client";
// app/estimate/[slug]/EstimateForm.jsx — the visitor's side of an installer's estimate page: the address and the
// bill (or the monthly kWh), a real estimate from /api/estimate (the same engine as the installer's quotes), then a
// request for the full proposal sent to /api/estimate-lead. Inline styles, no app stylesheet: the page also lives in
// an <iframe> on the installer's own site. The installer's colour (`color`, with `onColor` for text on it) marks the
// key actions.
import { useEffect, useRef, useState } from "react";
import { et, PHONE_EXAMPLE } from "../../../lib/estimateText.js";
import { moneyFormatter, numFor } from "../../../lib/money.js";
import { yearsN, kwhUnit, kwUnit } from "../../p/[code]/text.js";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const CURRENCY = { MD: "MDL", RO: "RON", UA: "UAH" };
const ERR = { no_address: "err_address", not_found: "err_not_found", rate: "err_rate", upstream: "err_upstream" };
const INK = "#142A21", MUTED = "#5D6B62", LINE = "#E3E1D6", RED = "#B4432F";

export default function EstimateForm({ slug, lang, market = "MD", company, color, onColor, embed = false }) {
  const cur = CURRENCY[market] || "EUR";
  const num = numFor(lang);
  const money = (eur, currency) => moneyFormatter({ currency: currency || cur, lang })(eur);

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

  async function send(e) {
    e.preventDefault();
    setSendErr("");
    if (!f.consent) { setSendErr(et("err_consent", lang)); return; }
    setSending(true);
    try {
      const r = await fetch("/api/estimate-lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, ...f, timeline: f.timeline || null, address,
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

  const S = {
    wrap: { maxWidth: 520, margin: "0 auto" },
    card: { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: "20px 18px", marginBottom: 14 },
    label: { display: "block", fontSize: 13, fontWeight: 600, color: INK, margin: "0 0 6px" },
    input: { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 15, fontFamily: "inherit", color: INK, background: "#fff", marginBottom: 12 },
    key: { width: "100%", padding: 13, borderRadius: 10, border: "none", background: color, color: onColor, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" },
    ghost: { background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" },
    err: { color: RED, fontSize: 13.5, margin: "0 0 10px" },
    seg: (on) => ({ flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      background: on ? "#fff" : "transparent", color: on ? INK : MUTED, boxShadow: on ? "0 1px 3px rgba(20,42,33,.15)" : "none" }),
  };

  return (
    <div style={S.wrap}>
      {!embed && (
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          {company.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={company.logo} alt="" style={{ height: 40, maxWidth: 140, objectFit: "contain" }} />
            : <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, background: color, color: onColor, display: "grid", placeItems: "center", fontWeight: 800 }}>{company.name.trim().charAt(0).toUpperCase()}</span>}
          <b style={{ fontSize: 17 }}>{company.name}</b>
        </header>
      )}

      {sent ? (
        <section style={{ ...S.card, textAlign: "center", padding: "34px 18px" }} role="status">
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{et("thanks_h", lang)}</h1>
          <p style={{ color: MUTED, margin: 0, lineHeight: 1.5 }}>{et("thanks", lang, { co: company.name })}</p>
        </section>
      ) : (
        <>
          <section style={S.card}>
            <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 6px" }}>{et("title", lang)}</h1>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>{et("sub", lang)}</p>
            {!res ? (
              <form onSubmit={calculate} noValidate>
                <label style={S.label} htmlFor="est-addr">{et("addr", lang)}</label>
                <input id="est-addr" style={S.input} value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder={et("addr_ph", lang)} autoComplete="street-address" required />
                <div role="radiogroup" aria-label={et("by", lang)} style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "#F1EFE8", marginBottom: 10 }}>
                  {["bill", "kwh"].map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={by === k} style={S.seg(by === k)} onClick={() => setBy(k)}>
                      {et("by", lang)} {et(k === "bill" ? "by_bill" : "by_kwh", lang)}
                    </button>
                  ))}
                </div>
                <label style={S.label} htmlFor="est-amount">
                  {by === "bill" ? et("bill_label", lang, { cur }) : et("kwh_label", lang, { unit: kwhUnit(lang) })}
                </label>
                <input id="est-amount" style={S.input} type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {err && <p style={S.err} role="alert">{err}</p>}
                <button type="submit" style={{ ...S.key, opacity: busy ? 0.7 : 1 }} disabled={busy} aria-busy={busy}>
                  {busy ? et("calculating", lang) : et("calc", lang)}
                </button>
              </form>
            ) : (
              <div>
                {res.location && <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 10px" }}>{et("res_for", lang, { place: res.location })}</p>}
                <dl style={{ margin: "0 0 12px" }}>
                  <Row k={et("res_kw", lang)} v={`${num(res.recommendedKw, 1)} ${kwUnit(lang)}`} />
                  <Row k={et("res_prod", lang)} v={`${num(res.prodKwh, 0)} ${kwhUnit(lang)}`} />
                  <Row k={et("res_price", lang)} v={money(res.cost.eur, res.currency)} />
                  {res.savingsMonthly && <Row k={et("res_save", lang)} v={money(res.savingsMonthly.eur, res.currency)} strong />}
                  {res.monthly && <Row k={et("res_monthly", lang)} v={money(res.monthly.eur, res.currency)}
                    note={et("res_monthly_note", lang, { y: res.monthly.years, r: num(res.monthly.ratePct, 1) })} />}
                  <Row k={et("res_payback", lang)} v={res.payback.expc == null ? yearsN(25, lang) : yearsN(Math.round(res.payback.expc * 10) / 10, lang)} />
                </dl>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, margin: "0 0 10px" }}>{et("res_note", lang, { co: company.name })}</p>
                <button type="button" style={S.ghost} onClick={() => setRes(null)}>{et("recalc", lang)}</button>
              </div>
            )}
          </section>

          {res && (
            <section style={S.card} aria-labelledby="est-cta-h">
              <h2 id="est-cta-h" style={{ fontSize: 18, margin: "0 0 14px" }}>{et("cta_h", lang, { co: company.name })}</h2>
              <form onSubmit={send} noValidate>
                <label style={S.label} htmlFor="est-name">{et("name", lang)}</label>
                <input id="est-name" style={S.input} value={f.name} onChange={set("name")} autoComplete="name" required />
                <label style={S.label} htmlFor="est-phone">{et("phone", lang)}</label>
                <input id="est-phone" style={S.input} type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel"
                  placeholder={PHONE_EXAMPLE[market] || PHONE_EXAMPLE.MD} required />
                <label style={S.label} htmlFor="est-email">{et("email", lang)}</label>
                <input id="est-email" style={S.input} type="email" value={f.email} onChange={set("email")} autoComplete="email" />
                <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
                  <legend style={S.label}>{et("when_q", lang)}</legend>
                  {["now", "soon", "later"].map((w) => (
                    <label key={w} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "5px 0", cursor: "pointer" }}>
                      <input type="radio" name="est-when" value={w} checked={f.timeline === w} onChange={set("timeline")} style={{ accentColor: color, width: 18, height: 18 }} />
                      {et("when_" + w, lang)}
                    </label>
                  ))}
                </fieldset>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "0 0 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={f.wantsFinancing} onChange={set("wantsFinancing")} style={{ accentColor: color, width: 18, height: 18 }} />
                  {et("fin", lang)}
                </label>
                <label style={S.label} htmlFor="est-msg">{et("msg", lang)}</label>
                <textarea id="est-msg" style={{ ...S.input, minHeight: 64, resize: "vertical" }} value={f.message} onChange={set("message")} maxLength={500} />
                {/* the honeypot: people never see it, bots fill it */}
                <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")}
                  style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.5, color: INK, margin: "0 0 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={f.consent} onChange={set("consent")} required style={{ accentColor: color, width: 18, height: 18, marginTop: 1, flex: "none" }} />
                  <span>
                    {et("consent", lang, { co: company.name })}{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: INK }}>{et("privacy", lang)}</a>
                  </span>
                </label>
                {TURNSTILE_SITE_KEY && <div ref={tsRef} style={{ margin: "0 0 12px" }} />}
                {sendErr && <p style={S.err} role="alert">{sendErr}</p>}
                <button type="submit" style={{ ...S.key, opacity: sending ? 0.7 : 1 }} disabled={sending} aria-busy={sending}>
                  {sending ? et("sending", lang) : et("send", lang)}
                </button>
              </form>
            </section>
          )}
        </>
      )}
      <p style={{ textAlign: "center", color: MUTED, fontSize: 11.5, margin: "6px 0 0" }}>{et("powered", lang)}</p>
    </div>
  );
}

function Row({ k, v, note, strong = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "8px 0", borderBottom: `1px solid ${LINE}` }}>
      <dt style={{ fontSize: 13.5, color: MUTED }}>{k}{note && <small style={{ display: "block", fontSize: 11.5 }}>{note}</small>}</dt>
      <dd style={{ margin: 0, fontWeight: 700, fontSize: strong ? 17 : 15, color: INK, textAlign: "right" }}>{v}</dd>
    </div>
  );
}
