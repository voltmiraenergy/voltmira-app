"use client";
// components/portfolio/PackPay.jsx — paying for a plant's bank pack (or a
// portfolio's data room) where it is downloaded: the tier and its price, card
// payment through Paddle (lib/paddle.js openPackCheckout) or an invoice for a
// bank transfer (app/api/portfolios/[id]/pack), and, once paid, until when the
// pack stays open. With the gate off (lib/packPricing.js PACK_PAYWALL) it shows
// nothing and every download works as before.
// children(locked): the download buttons, told whether the pack is locked.
import { useCallback, useEffect, useRef, useState } from "react";
import { bt } from "../../lib/bankText.js";
import { num } from "../../lib/portfolioFormat.js";
import { packCheckoutReady, openPackCheckout } from "../../lib/paddle.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function PackPay({ portfolioId, plantId = null, companyId = "", lang = "en", disabled = false, children }) {
  const [st, setSt] = useState(null);
  const [asking, setAsking] = useState(false);
  const [billing, setBilling] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const poll = useRef(null);
  const url = `/api/portfolios/${portfolioId}/pack${plantId ? `?plant=${encodeURIComponent(plantId)}` : ""}`;

  const load = useCallback(async () => {
    if (!portfolioId) return null;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      setSt(j);
      return j;
    } catch {
      return null;
    }
  }, [portfolioId, url]);

  // the status, once on mount; a late answer for an unmounted card is dropped
  useEffect(() => {
    let alive = true;
    if (portfolioId) {
      fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setSt(j); }).catch(() => {});
    }
    return () => { alive = false; clearInterval(poll.current); };
  }, [portfolioId, url]);

  const locked = !!(st && st.paywall && !st.open);
  const day = (iso) => new Date(iso).toLocaleDateString(LOC[lang] || "en-GB", { day: "numeric", month: "long", year: "numeric" });

  async function payCard() {
    setNote(""); setBusy(true);
    try {
      await openPackCheckout({ tier: st.tier, renewal: st.renewal, companyId, portfolioId, plantId });
      setNote(bt("pk_after_card", lang));
      // the webhook unlocks the pack; look again every few seconds for three minutes
      let n = 0;
      clearInterval(poll.current);
      poll.current = setInterval(async () => {
        n += 1;
        const j = await load();
        if ((j && j.open) || n > 36) { clearInterval(poll.current); if (j?.open) setNote(""); }
      }, 5000);
    } catch (e) {
      setNote(e?.message || bt("pk_err", lang));
    } finally {
      setBusy(false);
    }
  }

  async function askInvoice(e) {
    e.preventDefault();
    setNote(""); setBusy(true);
    try {
      const r = await fetch(`/api/portfolios/${portfolioId}/pack`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plant: plantId || "", billing }),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setAsking(false);
      setSt((s) => ({ ...s, requestedAt: j.requestedAt || new Date().toISOString(), open: !!j.open || s.open }));
    } catch {
      setNote(bt("pk_err", lang));
    } finally {
      setBusy(false);
    }
  }

  const tierName = st ? bt("pk_tier_" + st.tier, lang) : "";
  const price = st ? num(st.priceEur, lang, 0) : "";
  return (
    <>
      {st?.paywall && st.open && st.reason === "paid" && st.expiresAt && <p className="pl-line">{bt("pk_paid", lang, { d: day(st.expiresAt) })}</p>}
      {locked && (
        <div className="pk-pay">
          <p className="pl-line"><b>{bt(st.renewal ? "pk_renewal" : "pk_locked", lang, { tier: tierName, price })}</b></p>
          {st.requestedAt ? <p className="pf-hint" role="status">{bt("pk_requested", lang, { d: day(st.requestedAt) })}</p> : (
            <div className="pl-row">
              {packCheckoutReady(st.tier, st.renewal) && (
                <button type="button" className="btn primary sm" disabled={disabled || busy} onClick={payCard}>{bt("pk_card", lang)}</button>
              )}
              {!asking && <button type="button" className="btn ghost sm" disabled={disabled || busy} onClick={() => setAsking(true)}>{bt("pk_invoice", lang)}</button>}
            </div>
          )}
          {asking && !st.requestedAt && (
            <form className="pk-inv" onSubmit={askInvoice}>
              <label htmlFor={`pk-bill-${plantId || "room"}`}>{bt("pk_billing", lang)}</label>
              <textarea id={`pk-bill-${plantId || "room"}`} rows={3} maxLength={1000} value={billing} onChange={(e) => setBilling(e.target.value)} />
              <div className="pl-row">
                <button type="submit" className="btn primary sm" disabled={busy}>{bt("pk_send", lang)}</button>
                <button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>{bt("pk_cancel", lang)}</button>
              </div>
            </form>
          )}
          {note && <p className="pf-hint" role="status">{note}</p>}
        </div>
      )}
      {children ? children(locked) : null}
    </>
  );
}
