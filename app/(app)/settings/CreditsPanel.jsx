"use client";
// app/(app)/settings/CreditsPanel.jsx — credits on the Plan tab: the balance,
// the free offers used this month, two packs to buy by card (lib/paddle.js
// openCreditsCheckout), and the last movements. Shown to the free plan; a paid
// plan is told it does not need credits. A banner explains why the person was
// sent here when an offer or a grid file was refused (?need=offers|grid).
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { openCreditsCheckout, creditsCheckoutReady } from "../../../lib/paddle.js";
import { supabaseBrowser } from "../../../lib/supabase-browser.js";
import { CREDIT_PACKS } from "../../../lib/credits.js";
import { cr } from "../../../lib/creditsText.js";
import { fmtDate } from "../../../lib/tz.js";
import { LOCALE } from "../../../lib/relTime.js";

export default function CreditsPanel({ lang = "en", companyId, plan }) {
  const [s, setS] = useState(null);
  const [need, setNeed] = useState(null);
  const [bought, setBought] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => fetch("/api/credits", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setS(j)).catch(() => {});
  useEffect(() => {
    load();
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("need") === "offers" || q.get("need") === "grid") setNeed(q.get("need"));
      if (q.get("credits") === "1") { setBought(true); setTimeout(load, 6000); }
    } catch { /* no banner */ }
  }, []);

  const paid = plan !== "free";

  async function buy(pack) {
    setMsg("");
    try {
      const { data: { user } } = await supabaseBrowser().auth.getUser();
      await openCreditsCheckout({
        pack, email: user?.email, companyId,
        successUrl: (process.env.NEXT_PUBLIC_APP_URL || location.origin) + "/settings?tab=plan&credits=1",
      });
    } catch (e) { setMsg(e.message || cr("not_set", lang)); }
  }

  if (!s) return null;
  const loc = LOCALE[lang] || "en-GB";
  const ready = creditsCheckoutReady("c10") || creditsCheckoutReady("c50");
  const label = (r) => (r.delta > 0 ? cr("h_purchase", lang, { n: r.delta }) : cr("h_" + r.reason, lang));

  return (
    <>
      {need && !paid && <p className="cr-banner" role="status">{cr(need === "grid" ? "need_grid" : "need_offers", lang)}</p>}
      {bought && <p className="cr-banner ok" role="status">{cr("bought", lang)}</p>}
      <p className="st-p">{cr("desc", lang)}</p>
      {paid ? (
        <p className="st-p"><b>{cr("paid_plan", lang)}</b></p>
      ) : (
        <>
          {!s.on && <p className="st-p cr-dim">{cr("off", lang)}</p>}
          <p className="cr-balance"><Coins size={18} strokeWidth={1.9} aria-hidden="true" />{s.balance === 1 ? cr("balance_one", lang) : cr("balance", lang, { n: s.balance })}</p>
          <p className="st-p cr-dim">{cr("sent", lang, { n: Math.min(s.sent, s.freeOffers), max: s.freeOffers })}</p>
          <div className="st-plan-acts">
            {Object.values(CREDIT_PACKS).map((p) => (
              <button key={p.id} type="button" className={"dx-btn" + (p.id === "c50" ? " primary" : "")} disabled={!creditsCheckoutReady(p.id)} onClick={() => buy(p.id)}>
                {cr(p.id === "c10" ? "pack10" : "pack50", lang)}<small className="cr-each">{cr(p.id === "c10" ? "per_credit" : "per_credit_50", lang)}</small>
              </button>
            ))}
          </div>
          {!ready && <p className="st-p cr-dim">{cr("not_set", lang)}</p>}
          {msg && <p className="set-note">{msg}</p>}
          <p className="st-p cr-dim">{cr("cheaper", lang)}</p>
        </>
      )}
      {s.history.length > 0 && (
        <>
          <p className="cr-h">{cr("history", lang)}</p>
          <ul className="cr-hist">
            {s.history.map((r, i) => (
              <li key={i}><span>{label(r)}</span><b className={r.delta > 0 ? "up" : ""}>{r.delta > 0 ? "+" : "−"}{Math.abs(r.delta)}</b>
                <small>{fmtDate(r.created_at, loc, { day: "numeric", month: "short" })}</small></li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
