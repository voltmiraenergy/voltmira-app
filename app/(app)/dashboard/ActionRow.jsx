"use client";
// app/(app)/dashboard/ActionRow.jsx — the buttons of one dashboard row: the
// first one fixes the step (records it, sends the link, opens the invoice
// chooser), the rest are the other ways to do it and "Open". Writes go through
// runAction.js; the page refreshes itself afterwards, so the row disappears or
// moves on once its step is recorded.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runAction, RUNNABLE } from "./runAction.js";

const PATH = {
  phone: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />,
  link: <><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.5 5.4" /><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5" /></>,
  receipt: <><path d="M4 3h16v18l-3-2-3 2-2-2-2 2-3-2-3 2z" /><path d="M8 8h8" /><path d="M8 12h8" /></>,
};
// Recording buttons carry no tick mark: the label says what gets recorded.
const ICON = { tel: "phone", send: "link", copy_link: "link", invoice: "receipt" };
const Svg = ({ d }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATH[d]}</svg>
);
const DEPOSITS = [30, 50, 0];

export default function ActionRow({ actions = [], labels, small = false }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(null);
  const [inv, setInv] = useState(null);
  const [msg, setMsg] = useState(null);

  function run(a, i) {
    setMsg(null);
    setBusy(i);
    start(async () => {
      try {
        const r = await runAction(a);
        if (r.go) { router.push(r.go); return; }
        if (r.copied) setMsg({ ok: true, text: `${labels.copied}: ${r.copied}` });
        router.refresh();
      } catch {
        setMsg({ ok: false, text: labels.failed });
      } finally { setBusy(null); }
    });
  }

  const list = actions.filter((a) => a && a.label);
  if (!list.length) return null;
  return (
    <div className={"dx-acts" + (small ? " sm" : "")}>
      <div className="dx-acts-row">
        {list.map((a, i) => {
          const cls = "dx-btn" + (i === 0 ? " primary" : "") + (a.type === "tel" ? " call" : "");
          const ic = ICON[a.type] ? <Svg d={ICON[a.type]} /> : null;
          if (a.type === "link") return <Link key={i} href={a.href} className={cls}>{a.label}</Link>;
          if (a.type === "tel") return <a key={i} href={`tel:${String(a.phone).replace(/\s+/g, "")}`} className={cls}>{ic}{a.label}</a>;
          if (a.type === "invoice") {
            return (
              <button key={i} type="button" className={cls} aria-expanded={inv === i} onClick={() => setInv(inv === i ? null : i)}>
                {ic}{a.label}
              </button>
            );
          }
          if (!RUNNABLE.has(a.type)) return null;
          return (
            <button key={i} type="button" className={cls} disabled={pending} aria-busy={pending && busy === i} onClick={() => run(a, i)}>
              {ic}{a.label}
            </button>
          );
        })}
      </div>
      {inv != null && list[inv] && (
        <div className="dx-inv" role="group" aria-label={labels.invPick}>
          <span>{labels.invPick}</span>
          {DEPOSITS.map((pct) => (
            <a key={pct} className="dx-btn" target="_blank" rel="noopener noreferrer" onClick={() => setInv(null)}
              href={`/projects/${list[inv].projectId}/invoice${pct > 0 ? `?deposit=${pct}` : ""}`}>
              {pct > 0 ? `${pct}%` : labels.invFull}
            </a>
          ))}
        </div>
      )}
      {msg && <p className={"dx-acts-msg " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</p>}
    </div>
  );
}
