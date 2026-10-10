"use client";
// components/portfolio/PackPay.jsx — paying for a plant's bank pack (or a
// portfolio's data room) where it is downloaded: the tier and its price, card
// payment through Paddle (lib/paddle.js openPackCheckout) or an invoice for a
// bank transfer (app/api/portfolios/[id]/pack), and, once paid, until when the
// pack stays open. With the gate off (lib/packPricing.js PACK_PAYWALL) it shows
// nothing and every download works as before. On a local machine with
// PACK_TEST_PAY=on, "Pay by card (test)" opens a test checkout that unlocks the
// pack as a paid card payment would (app/api/portfolios/[id]/pack/test-pay).
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
  const [testing, setTesting] = useState(false);
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

  // the local test checkout: what Paddle's overlay would charge, unlocked as its webhook would
  async function payTest() {
    setNote(""); setBusy(true);
    try {
      const r = await fetch(`/api/portfolios/${portfolioId}/pack/test-pay`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plant: plantId || "" }),
      });
      if (!r.ok) throw new Error();
      setTesting(false);
      await load();
    } catch {
      setNote(bt("pk_err", lang));
    } finally {
      setBusy(false);
    }
  }

  async function askInvoice() {
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
          {st.requestedAt && <p className="pf-hint" role="status">{bt("pk_requested", lang, { d: day(st.requestedAt) })}</p>}
          {/* a card payment stays possible after an invoice was asked for */}
          <div className="pl-row">
            {st.testPay
              ? <button type="button" className="btn primary sm" disabled={disabled || busy} onClick={() => setTesting(true)}>{bt("pk_test_btn", lang)}</button>
              : packCheckoutReady(st.tier, st.renewal) && (
                <button type="button" className="btn primary sm" disabled={disabled || busy} onClick={payCard}>{bt("pk_card", lang)}</button>
              )}
            {!asking && !st.requestedAt && <button type="button" className="btn ghost sm" disabled={disabled || busy} onClick={() => setAsking(true)}>{bt("pk_invoice", lang)}</button>}
          </div>
          {/* not a <form>: the box can sit inside a page's own form */}
          {asking && !st.requestedAt && (
            <div className="pk-inv">
              <label htmlFor={`pk-bill-${plantId || "room"}`}>{bt("pk_billing", lang)}</label>
              <textarea id={`pk-bill-${plantId || "room"}`} rows={3} maxLength={1000} value={billing} onChange={(e) => setBilling(e.target.value)} />
              <div className="pl-row">
                <button type="button" className="btn primary sm" disabled={busy} onClick={askInvoice}>{bt("pk_send", lang)}</button>
                <button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>{bt("pk_cancel", lang)}</button>
              </div>
            </div>
          )}
          {testing && (
            <div className="pk-modal" role="dialog" aria-modal="true" aria-labelledby={`pk-test-h-${plantId || "room"}`} onKeyDown={(e) => { if (e.key === "Escape") setTesting(false); }}>
              <div className="pk-sheet">
                <h4 id={`pk-test-h-${plantId || "room"}`}>{bt("pk_test_h", lang)}</h4>
                <p className="pf-hint">{bt("pk_test_p", lang)}</p>
                <dl className="pk-lines">
                  <div><dt>{bt("pk_test_item", lang)}</dt><dd>{tierName}</dd></div>
                  <div><dt>{bt("pk_test_card", lang)}</dt><dd className="pk-card">4242 4242 4242 4242</dd></div>
                  <div className="pk-total"><dt>{bt("pk_test_total", lang)}</dt><dd>{price} EUR</dd></div>
                </dl>
                <p className="pf-hint">{bt("pk_test_vat", lang)}</p>
                <div className="pl-row">
                  <button type="button" className="btn primary" autoFocus disabled={busy} onClick={payTest}>{bt("pk_test_pay", lang, { price })}</button>
                  <button type="button" className="btn ghost" disabled={busy} onClick={() => setTesting(false)}>{bt("pk_cancel", lang)}</button>
                </div>
              </div>
            </div>
          )}
          {note && <p className="pf-hint" role="status">{note}</p>}
        </div>
      )}
      {children ? children(locked) : null}
    </>
  );
}
