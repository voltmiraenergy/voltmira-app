"use client";
// app/(app)/dashboard/ActionRow.jsx — the buttons of one dashboard row: the
// first one fixes the step (records it, sends the link, opens the invoice
// chooser), the rest are the other ways to do it and "Open". Writes go through
// runAction.js; the page refreshes itself afterwards, so the row disappears or
// moves on once its step is recorded. "Mark it signed" is never the main button and asks first: signing
// moves the quote to Jobs and starts the VoltMira fee, so a stray tap must not do it. WhatsApp and the
// calendar (a visit) are plain links or a file, nothing is written.
import { useState, useTransition } from "react";
import { waLink, googleCalUrl } from "../../../lib/contactLinks.js";
import { visitIcs } from "../../../lib/ics.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runAction, RUNNABLE } from "./runAction.js";

const PATH = {
  phone: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />,
  link: <><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.5 5.4" /><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5" /></>,
  receipt: <><path d="M4 3h16v18l-3-2-3 2-2-2-2 2-3-2-3 2z" /><path d="M8 8h8" /><path d="M8 12h8" /></>,
  chat: <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />,
  cal: <><path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></>,
};
// Recording buttons carry no tick mark: the label says what gets recorded.
const ICON = { tel: "phone", wa: "chat", cal: "cal", send: "link", copy_link: "link", invoice: "receipt" };
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
  const [ask, setAsk] = useState(null);   // the "mark it signed?" question, open for that button

  function toCalendar(a) {
    const ics = visitIcs({ uid: a.uid, start: a.start, minutes: a.minutes || 60, title: a.title, location: a.location || "", description: a.details || "" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    el.download = (a.title || "vizita").toLowerCase().replace(/[^a-z0-9ăâîșțа-я]+/gi, "-").replace(/^-|-$/g, "") + ".ics";
    el.click();
    setTimeout(() => URL.revokeObjectURL(el.href), 2000);
  }

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
          const cls = "dx-btn" + (i === 0 && a.type !== "won" ? " primary" : "") + (a.type === "tel" ? " call" : "") + (a.type === "won" ? " quiet" : "");
          const ic = ICON[a.type] ? <Svg d={ICON[a.type]} /> : null;
          if (a.type === "link") return <Link key={i} href={a.href} className={cls}>{a.label}</Link>;
          if (a.type === "tel") return <a key={i} href={`tel:${String(a.phone).replace(/\s+/g, "")}`} className={cls}>{ic}{a.label}</a>;
          if (a.type === "wa") {
            const href = waLink(a.phone);
            return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={cls + " wa"}>{ic}{a.label}</a> : null;
          }
          if (a.type === "cal") {
            const g = googleCalUrl(a);
            return (
              <span key={i} className="dx-cal">
                <button type="button" className={cls} onClick={() => toCalendar(a)}>{ic}{a.label}</button>
                {g && <a className="dx-cal-g" href={g} target="_blank" rel="noopener noreferrer">{labels.gcal}</a>}
              </span>
            );
          }
          if (a.type === "won") {
            return (
              <button key={i} type="button" className={cls} disabled={pending} aria-expanded={ask === i} onClick={() => setAsk(ask === i ? null : i)}>
                {a.label}
              </button>
            );
          }
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
      {ask != null && list[ask] && (
        <div className="dx-ask" role="alertdialog" aria-label={labels.wonQ}>
          <p><b>{labels.wonQ}</b> {labels.wonP}</p>
          <div className="dx-acts-row">
            <button type="button" className="dx-btn primary" disabled={pending} aria-busy={pending && busy === ask}
              onClick={() => { const i = ask; setAsk(null); run(list[i], i); }}>{labels.wonYes}</button>
            <button type="button" className="dx-btn" onClick={() => setAsk(null)}>{labels.wonNo}</button>
          </div>
        </div>
      )}
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
