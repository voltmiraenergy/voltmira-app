"use client";
// app/(app)/dashboard/NextMoves.jsx — "To do": the ranked list of what needs
// the installer, most urgent first (lib/dashboardMoves.js ranks it on the
// server). Five rows at a time. Each row says why it is there and carries the
// button that fixes it: record the step, send or resend the link, issue the
// deposit invoice, mark it signed, call (ActionRow.jsx). "Done for today" is a
// personal tick kept in this browser only, not a change to the quote, so it
// resets on its own the next morning.
import { useEffect, useState } from "react";
import Link from "next/link";
import ActionRow from "./ActionRow.jsx";

const STORE = "vm_dx_done";
const VISIBLE = 5;

const P = {
  eye: <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>,
  flame: <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />,
  cal: <><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></>,
  userPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></>,
  play: <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />,
  receipt: <><path d="M4 3h16v18l-3-2-3 2-2-2-2 2-3-2-3 2z" /><path d="M8 8h8" /><path d="M8 12h8" /></>,
  mail: <><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6h4" /></>,
  pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  down: <><path d="M16 17h6v-6" /><path d="m22 17-8.5-8.5-5 5L2 7" /></>,
  pulse: <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />,
  check: <path d="M20 6 9 17l-5-5" />,
  plug: <><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></>,
  alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
};
const KIND_ICON = {
  live: "eye", hot: "flame", followup: "cal", lead: "userPlus", visit: "cal", visit_done: "pen", won_start: "play", install: "wrench",
  invoice: "receipt", unopened: "mail", quiet: "clock", draft: "pen", health: "down", nodata: "pulse", grid: "plug", unmonitored: "pulse",
  gap: "alert",
};
const Svg = ({ d, size = 17, w = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[d]}</svg>
);

/** "**bold** plain" → React nodes. Only the dictionary produces these strings. */
function rich(s) {
  return String(s).split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

function readDone(todayKey) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) || "{}");
    // Keep only today's ticks, so yesterday's never hide anything.
    const today = {};
    for (const k in all) if (all[k] === todayKey) today[k] = todayKey;
    return today;
  } catch { return {}; }
}

export default function NextMoves({ moves, labels, todayKey, stuck }) {
  const [more, setMore] = useState(false);
  const [done, setDone] = useState({});
  useEffect(() => { setDone(readDone(todayKey)); }, [todayKey]);

  const saveDone = (next) => {
    setDone(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  };

  const active = moves.filter((m) => !done[m.key]);
  const hiddenN = moves.length - active.length;
  const shown = more ? active : active.slice(0, VISIBLE);

  return (
    <section className="dx-card dx-moves" aria-labelledby="dx-moves-h">
      <header className="dx-card-head">
        <div>
          <h2 id="dx-moves-h">{labels.title}<span className="dx-count">{active.length}</span></h2>
          <p>{labels.sub}</p>
        </div>
        {stuck && stuck.n > 0 && <Link className="dx-link dx-stuck-link" href="/projects?view=stuck">{stuck.label}</Link>}
      </header>

      {shown.length ? (
        <ol className="dx-move-list">
          {shown.map((m) => (
            <li key={m.key} className={"dx-move k-" + m.kind}>
              <span className="dx-move-ic" aria-hidden="true" title={labels.kinds[m.kind]}>
                <Svg d={KIND_ICON[m.kind] || "pulse"} />
              </span>
              <div className="dx-move-body">
                <div className="dx-move-who">
                  <Link href={m.href} className="dx-move-title">{m.title}</Link>
                  {m.sub && <span className="dx-move-sub">{m.sub}</span>}
                  {m.hot && <span className="dx-hot">{labels.hot}</span>}
                  {m.ago && <time>{m.ago}</time>}
                </div>
                <p className="dx-move-reason"><span className="dx-kind">{labels.kinds[m.kind]}</span>{rich(m.reason)}</p>
                {m.note && <p className="dx-move-note">{m.note}</p>}
                <ActionRow actions={m.actions} labels={labels.acts} />
              </div>
              <button type="button" className="dx-done" title={labels.done} aria-label={labels.done + ": " + m.title}
                onClick={() => saveDone({ ...done, [m.key]: todayKey })}>
                <Svg d="check" size={15} w={2.4} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="dx-empty">
          <span className="dx-empty-ic" aria-hidden="true"><Svg d="check" size={20} w={2.4} /></span>
          <b>{labels.emptyT}</b>
          <span>{labels.emptyS}</span>
        </div>
      )}

      {(active.length > VISIBLE || hiddenN > 0) && (
        <footer className="dx-moves-foot">
          {active.length > VISIBLE
            ? <button type="button" className="dx-link" onClick={() => setMore((v) => !v)}>
                {more ? labels.less : labels.more.replace("{n}", String(active.length))}
              </button>
            : <span />}
          {hiddenN > 0 && (
            <span className="dx-hidden">
              {labels.hidden.replace("{n}", String(hiddenN))}
              <button type="button" className="dx-link" onClick={() => saveDone({})}>{labels.restore}</button>
            </span>
          )}
        </footer>
      )}
    </section>
  );
}
