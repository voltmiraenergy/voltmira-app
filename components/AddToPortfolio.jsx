"use client";
// components/AddToPortfolio.jsx — put a won quote into a lender portfolio
// (app/(app)/portfolios): an existing one of the same market, or a new one
// started with this quote already in it. Server actions in
// lib/workflowActions.js do the work on the caller's own session, so RLS
// applies; the quote is appended to portfolios.project_ids without duplicates.
//
// Renders nothing unless the quote is won and in a market the portfolio model
// covers (Moldova, Ukraine): a draft has nothing to package yet. The root
// carries id="portfolio", which the workflow rail's "Add to a portfolio"
// action scrolls to.
//
// Props
//   projectId  string, required    the quote's id
//   lang       "en"|"ro"|"ru"|"uk"  interface language (default "en")
//   status     string, required    the quote's status ("won" shows the card)
//   market     string, required    the quote's market ("MD" | "UA" show the card)
//   onAdded    ({ id, name }) => void   optional; after the quote went into a portfolio
import "./workflow.css";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listPortfoliosFor, addToPortfolio, createPortfolioWith } from "../lib/workflowActions.js";
import { wt } from "../lib/workflowText.js";

export default function AddToPortfolio({ projectId, lang = "en", status, market, onAdded }) {
  if (status !== "won" || (market !== "MD" && market !== "UA")) return null;
  return <PortfolioCard projectId={projectId} lang={lang} market={market} status={status} onAdded={onAdded} />;
}

function PortfolioCard({ projectId, lang, market, status, onAdded }) {
  const router = useRouter();
  const [state, setState] = useState(null);
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // State is only set once the answer is in.
  const load = useCallback(() => listPortfoliosFor(projectId).then(
    (r) => {
      setState(r || { state: "error" });
      const free = (r?.portfolios || []).filter((x) => !x.has);
      setPick((cur) => (free.some((x) => x.id === cur) ? cur : free[0]?.id || ""));
    },
    () => setState({ state: "error" }),
  ), [projectId]);

  useEffect(() => { load(); }, [load, status, market]);

  const marketName = wt(market === "UA" ? "ap_market_ua" : "ap_market_md", lang);

  async function done(res) {
    if (res?.ok && res.portfolio) {
      setMsg({ ok: true, text: wt("ap_added", lang, { name: res.portfolio.name }), id: res.portfolio.id });
      setName("");
      onAdded?.(res.portfolio);
      // the workflow rail on the same page re-reads (components/WorkflowRail.jsx)
      try { window.dispatchEvent(new CustomEvent("voltmira:workflow", { detail: { projectId } })); } catch { /* old browser: it re-reads on focus */ }
      await load();
      router.refresh();
    } else {
      setMsg({ ok: false, text: wt(res?.error === "needs_db" ? "ap_needs_db" : res?.error === "market" ? "ap_market" : res?.error === "not_won" ? "ap_not_won" : "ap_err", lang) });
    }
  }
  async function add(e) {
    e.preventDefault();
    if (!pick || busy) return;
    setBusy(true); setMsg(null);
    try { await done(await addToPortfolio(projectId, pick)); } catch { await done(null); } finally { setBusy(false); }
  }
  async function create(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setMsg(null);
    try { await done(await createPortfolioWith(projectId, name)); } catch { await done(null); } finally { setBusy(false); }
  }

  const list = state?.portfolios || [];
  const holding = list.filter((x) => x.has);
  const free = list.filter((x) => !x.has);

  return (
    <section id="portfolio" className="card wfp" aria-labelledby="wfp-h" aria-busy={!state || busy}>
      <h3 id="wfp-h">{wt("ap_title", lang)}</h3>
      <p className="wfp-sub">{wt("ap_sub", lang)}</p>

      {!state ? (
        <p className="wfp-note">{wt("rl_loading", lang)}</p>
      ) : state.state === "needs_db" ? (
        <p className="wfp-note" role="alert">{wt("ap_needs_db", lang)}</p>
      ) : state.state === "market" ? (
        <p className="wfp-note">{wt("ap_market", lang)}</p>
      ) : state.state === "not_won" ? (
        <p className="wfp-note">{wt("ap_not_won", lang)}</p>
      ) : state.state !== "ok" ? (
        <p className="wfp-msg bad" role="alert">{wt("ap_err", lang)}</p>
      ) : (
        <>
          {holding.length > 0 && (
            <ul className="wfp-in">
              {holding.map((x) => (
                <li key={x.id}>
                  <b>{wt("ap_in", lang, { name: x.name || wt("ap_title", lang) })}</b>
                  <Link href={`/portfolios/${x.id}`}>{wt("ap_open", lang)}</Link>
                </li>
              ))}
            </ul>
          )}

          {free.length > 0 ? (
            <form className="wfp-row" onSubmit={add}>
              <div className="field">
                <label htmlFor="wfp-pick">{wt("ap_pick", lang)}</label>
                <select id="wfp-pick" className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
                  {free.map((x) => (
                    <option key={x.id} value={x.id}>{(x.name || wt("ap_title", lang)) + ", " + wt("ap_count", lang, { n: x.n })}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn primary sm" disabled={busy || !pick} aria-busy={busy}>{wt("ap_add", lang)}</button>
            </form>
          ) : holding.length === 0 ? (
            <p className="wfp-note">{wt("ap_none", lang, { market: marketName })}</p>
          ) : null}

          <form className="wfp-row" onSubmit={create}>
            <div className="field">
              <label htmlFor="wfp-name">{wt("ap_new", lang)}</label>
              <input id="wfp-name" className="input" value={name} maxLength={160} placeholder={wt("ap_new_ph", lang)}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="submit" className={"btn sm " + (free.length ? "ghost" : "primary")} disabled={busy || !name.trim()} aria-busy={busy}>
              {wt("ap_create", lang)}
            </button>
          </form>
        </>
      )}

      {msg && (
        <p className={"wfp-msg " + (msg.ok ? "ok" : "bad")} role="status">
          {msg.text}
          {msg.ok && msg.id && <Link href={`/portfolios/${msg.id}`}>{wt("ap_open", lang)}</Link>}
        </p>
      )}
    </section>
  );
}
