"use client";
// app/widget/WidgetForm.jsx — the public embeddable widget. `lang` is resolved
// on the server from the installer's company setting (see page.jsx), so a
// homeowner on a Romanian installer's site reads Romanian without the embed
// passing anything; `market` (RO/MD) drives which currency the bill is asked
// in and which country app/api/estimate/route.js prices against.
//
// Two real steps, not a mock: (1) address + bill -> a live call to
// app/api/estimate (real geocoding, real PVGIS yield, the SAME quote() engine
// the paid product runs) shows a genuine recommended size/price/payback
// before anyone talks to an installer; (2) the existing contact fields convert
// that into a real lead via app/api/widget-lead, with what was shown folded
// into the lead's note so the installer isn't guessing what was promised.
//
// Deliberately self-contained inline styles, no CSS-variable dependency — this
// renders inside an <iframe> on an installer's OWN website, not inside
// VoltMira's own app shell.
import { useState } from "react";
import { t } from "../../lib/i18n.js";
import { formatMoney } from "@voltmira/engine";

const CURRENCY_BY_MARKET = { RO: "RON", MD: "MDL" };
const ERROR_KEY = { no_address: "wg_err_no_address", not_found: "wg_err_not_found", rate: "wg_err_rate", upstream: "wg_err_upstream" };

export default function WidgetForm({ companyId, lang, market = "MD" }) {
  const currency = CURRENCY_BY_MARKET[market] || "EUR";
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-IE";

  const [address, setAddress] = useState("");
  const [bill, setBill] = useState("");
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcErr, setCalcErr] = useState("");
  const [result, setResult] = useState(null); // the /api/estimate response, once calculated

  const [f, setF] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [sendBusy, setSendBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [sent, setSent] = useState(false);

  async function calculate(e) {
    e.preventDefault();
    if (!address.trim()) { setCalcErr(t("wg_err_no_address", lang)); return; }
    setCalcBusy(true); setCalcErr(""); setResult(null);
    try {
      const qs = new URLSearchParams({ address, country: market });
      if (bill) qs.set("bill", bill);
      const res = await fetch(`/api/estimate?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        setCalcErr(t(ERROR_KEY[data?.error] || "wg_err", lang));
      } else {
        setResult(data);
      }
    } catch {
      setCalcErr(t("wg_err_upstream", lang));
    } finally {
      setCalcBusy(false);
    }
  }

  async function send(e) {
    e.preventDefault(); setSendErr(""); setSendBusy(true);
    const res = await fetch("/api/widget-lead", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId, address, bill, ...f,
        estKw: result?.recommendedKw, estCostLocal: result?.cost?.local, estPaybackYears: result?.payback?.expc,
      }),
    }).catch(() => null);
    setSendBusy(false);
    if (res && res.ok) setSent(true);
    else setSendErr(t("wg_err", lang));
  }

  const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3E1D6",
    fontSize: 14, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!companyId) return <p style={{ padding: 20, color: "#C4543B" }}>{t("wg_missing_id", lang)}</p>;
  if (sent) return (
    <div style={{ textAlign: "center", padding: "30px 10px" }}>
      <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#E4EFE9", color: "#1E6B4E",
        display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 26 }}>✓</div>
      <h2 style={{ fontFamily: "Inter", margin: "0 0 6px" }}>{t("wg_thanks", lang)}</h2>
      <p style={{ color: "#66756C", fontSize: 14 }}>{t("wg_thanks_sub", lang)}</p>
    </div>
  );

  const pbYears = (n) => (n == null ? "25+" : n.toFixed(1));

  return (
    <div>
      <h2 style={{ fontFamily: "Inter", letterSpacing: "-0.02em", margin: "0 0 4px" }}>{t("wg_title", lang)}</h2>
      <p style={{ color: "#66756C", fontSize: 13.5, margin: "0 0 16px" }}>{t("wg_sub", lang)}</p>

      {!result ? (
        <form onSubmit={calculate}>
          <input style={input} placeholder={t("wg_addr_ph", lang)} value={address}
            onChange={(e) => setAddress(e.target.value)} required />
          <input style={input} placeholder={t("wg_bill", lang, { cur: currency })} type="number" min="0"
            value={bill} onChange={(e) => setBill(e.target.value)} />
          {calcErr && <p style={{ color: "#C4543B", fontSize: 13 }}>{calcErr}</p>}
          <button type="submit" disabled={calcBusy} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none",
            background: "#1E6B4E", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
            opacity: calcBusy ? 0.7 : 1 }}>
            {calcBusy ? t("wg_calculating", lang) : t("wg_calc", lang)}
          </button>
        </form>
      ) : (
        <div>
          <button type="button" onClick={() => setResult(null)} style={{ background: "none", border: "none",
            color: "#66756C", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 10 }}>
            {t("wg_recalc", lang)}
          </button>

          {result.location && (
            <p style={{ fontSize: 12, color: "#66756C", margin: "0 0 12px" }}>{t("wg_res_loc", lang, { loc: result.location })}</p>
          )}

          <div style={{ border: "1px solid #E3E1D6", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <Row label={t("wg_res_kw", lang)} value={`${result.recommendedKw.toFixed(1)} kW`} />
            <Row label={t("wg_res_prod", lang)} value={`${Math.round(result.prodKwh).toLocaleString(loc)} kWh`} />
            <Row label={t("wg_res_price", lang)} value={formatMoney(result.cost.eur, result.currency)} />
            <Row label={t("wg_res_payback", lang)}
              value={`${pbYears(result.payback.opti)}–${pbYears(result.payback.pess)} ${t("years_w", lang)}`} />
          </div>
          <p style={{ fontSize: 11, color: "#66756C", lineHeight: 1.5, margin: "0 0 16px" }}>{t("wg_disclaimer", lang)}</p>

          <form onSubmit={send} style={{ background: "#E4EFE9", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#142A21", marginBottom: 10 }}>{t("wg_cta_title", lang)}</div>
            <input style={input} placeholder={t("wg_name", lang)} value={f.name} onChange={set("name")} required />
            <input style={input} placeholder={t("wg_email", lang)} type="email" value={f.email} onChange={set("email")} />
            <input style={input} placeholder={t("wg_phone", lang)} type="tel" value={f.phone} onChange={set("phone")} />
            <textarea style={{ ...input, minHeight: 54 }} placeholder={t("wg_msg", lang)} value={f.message} onChange={set("message")} />
            {/* honeypot — bots fill it, humans never see it */}
            <input style={{ position: "absolute", left: -9999 }} tabIndex={-1} autoComplete="off"
                   value={f.website} onChange={set("website")} placeholder="website" />
            {sendErr && <p style={{ color: "#C4543B", fontSize: 13 }}>{sendErr}</p>}
            <button disabled={sendBusy} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none",
              background: "#E89B2D", color: "#142A21", fontWeight: 700, fontSize: 15, cursor: "pointer",
              opacity: sendBusy ? 0.7 : 1 }}>
              {sendBusy ? t("wg_sending", lang) : t("wg_send", lang)}
            </button>
            <p style={{ fontSize: 10.5, color: "#66756C", lineHeight: 1.5, margin: "8px 0 0" }}>
              {t("wg_consent", lang)}{" "}
              <a href="https://voltmira.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#1E6B4E" }}>
                {t("wg_consent_link", lang)}
              </a>.
            </p>
          </form>
        </div>
      )}

      <p style={{ textAlign: "center", color: "#66756C", fontSize: 11, marginTop: 12 }}>{t("wg_powered", lang)}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "6px 0", fontSize: 13, color: "#66756C" }}>
      <span>{label}</span>
      <b style={{ color: "#142A21", fontFamily: "Inter", fontWeight: 700, textAlign: "right" }}>{value}</b>
    </div>
  );
}
