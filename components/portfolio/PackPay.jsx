"use client";
// components/portfolio/PackPay.jsx — the paywall of a plant's bank pack (in the
// plant card) or of a portfolio's own documents (in the export section): what
// the pack holds, its one price beside it, card payment through Paddle
// (lib/paddle.js openPackCheckout) or an invoice for a bank transfer
// (app/api/portfolios/[id]/pack), and once paid, until when it stays open.
// Everything stays readable; only the downloads wait for the payment. With the
// gate off (lib/packPricing.js PACK_PAYWALL) it shows nothing and every
// download works as before. A portfolio of one plant pays with that plant's
// pack, from either paywall (its plant card, its export section). On a local machine with PACK_TEST_PAY=on, "Pay by card (test)"
// opens a test checkout (app/api/portfolios/[id]/pack/test-pay).
// children(locked): the download buttons, told whether they are locked.
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, FileText, FileSpreadsheet, FileType, Map as MapIcon, Link2, CreditCard, Landmark, Scale } from "lucide-react";
import { bt } from "../../lib/bankText.js";
import { num } from "../../lib/portfolioFormat.js";
import { packCheckoutReady, openPackCheckout } from "../../lib/paddle.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

// what each kind of pack holds, in the order a credit officer reads it
const ITEMS = {
  plant: [[FileText, "pw_i_summary"], [FileSpreadsheet, "pw_i_model"], [FileType, "pw_i_word"], [MapIcon, "pw_i_site"], [Link2, "pw_i_deal"]],
  project: [[FileText, "pw_i_summary"], [FileSpreadsheet, "pw_i_model"], [FileType, "pw_i_word"], [MapIcon, "pw_i_site"], [Link2, "pw_i_deal"], [FileText, "pw_i_project"]],
  portfolio: [[FileText, "pw_i_report"], [FileSpreadsheet, "pw_i_portfolio_model"], [FileType, "pw_i_room"]],
};

export default function PackPay({ portfolioId, plantId = null, companyId = "", lang = "en", disabled = false, children }) {
  const [st, setSt] = useState(null);
  const [asking, setAsking] = useState(false);
  const [billing, setBilling] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [testing, setTesting] = useState(false);
  const poll = useRef(null);
  const url = `/api/portfolios/${portfolioId}/pack${plantId ? `?plant=${encodeURIComponent(plantId)}` : ""}`;
  const key = plantId || "room";

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
  // what the payment is for: this plant, or the plant whose pack opens the portfolio's documents
  const payFor = st?.payPlantId ?? plantId ?? "";
  const day = (iso) => new Date(iso).toLocaleDateString(LOC[lang] || "en-GB", { day: "numeric", month: "long", year: "numeric" });

  async function payCard() {
    setNote(""); setBusy(true);
    try {
      await openPackCheckout({ tier: st.tier, renewal: st.renewal, companyId, portfolioId, plantId: payFor || null });
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
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plant: payFor }),
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
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plant: payFor, billing }),
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
  const cardReady = st && (st.testPay || packCheckoutReady(st.tier, st.renewal));

  // a portfolio of one plant: the same paywall wherever its downloads are (the plant
  // card, the export section), paying for that plant's pack; a hint pointing elsewhere
  // left the customer looking for a price they could not see
  const projectWide = st?.scope === "project";
  const items = ITEMS[projectWide ? "project" : plantId ? "plant" : "portfolio"];

  return (
    <>
      {st?.paywall && st.open && st.reason === "paid" && st.expiresAt && <p className="pl-line">{bt("pk_paid", lang, { d: day(st.expiresAt) })}</p>}
      {locked && (
        <section className="pw" aria-labelledby={`pw-h-${key}`}>
          <div className="pw-main">
            <p className="pw-eyebrow"><Lock size={13} aria-hidden="true" />{tierName}</p>
            <h4 id={`pw-h-${key}`}>{bt(st.renewal ? "pw_title_renew" : plantId || projectWide ? "pw_title" : "pw_title_portfolio", lang)}</h4>
            <p className="pw-sub">{bt(st.renewal ? "pw_sub_renew" : "pw_sub", lang)}</p>
            <p className="pw-label">{bt("pw_includes", lang)}</p>
            <ul className="pw-list">
              {items.map(([Icon, k]) => <li key={k}><Icon size={17} aria-hidden="true" /><span>{bt(k, lang)}</span></li>)}
            </ul>
            <p className="pw-trust"><Scale size={15} aria-hidden="true" /><span>{bt("pw_trust", lang)}</span></p>
          </div>

          <div className="pw-side">
            <div className="pw-price"><b>{price}</b><span>EUR</span></div>
            <p className="pw-terms"><b>{bt("pw_once", lang)}</b>. {bt("pw_rerun", lang)}</p>
            {st.requestedAt && <p className="pw-status" role="status">{bt("pk_requested", lang, { d: day(st.requestedAt) })}</p>}
            <div className="pw-actions">
              {cardReady && (
                <button type="button" className="btn primary" disabled={disabled || busy} onClick={() => (st.testPay ? setTesting(true) : payCard())}>
                  <CreditCard size={16} aria-hidden="true" />{bt(st.testPay ? "pk_test_btn" : "pk_card", lang)}
                </button>
              )}
              {!asking && !st.requestedAt && (
                <button type="button" className={"btn " + (cardReady ? "ghost" : "primary")} disabled={disabled || busy} onClick={() => setAsking(true)}>
                  <Landmark size={16} aria-hidden="true" />{bt("pk_invoice", lang)}
                </button>
              )}
            </div>
            {/* not a <form>: the paywall can sit inside a page's own form */}
            {asking && !st.requestedAt && (
              <div className="pk-inv">
                <label htmlFor={`pk-bill-${key}`}>{bt("pk_billing", lang)}</label>
                <textarea id={`pk-bill-${key}`} rows={3} maxLength={1000} value={billing} onChange={(e) => setBilling(e.target.value)} />
                <div className="pl-row">
                  <button type="button" className="btn primary sm" disabled={busy} onClick={askInvoice}>{bt("pk_send", lang)}</button>
                  <button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>{bt("pk_cancel", lang)}</button>
                </div>
              </div>
            )}
            {note && <p className="pf-hint" role="status">{note}</p>}
            {cardReady && <p className="pw-secure">{bt("pw_secure", lang)}</p>}
          </div>

          {testing && (
            <div className="pk-modal" role="dialog" aria-modal="true" aria-labelledby={`pk-test-h-${key}`} onKeyDown={(e) => { if (e.key === "Escape") setTesting(false); }}>
              <div className="pk-sheet">
                <h4 id={`pk-test-h-${key}`}>{bt("pk_test_h", lang)}</h4>
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
        </section>
      )}
      {children ? children(locked) : null}
    </>
  );
}
