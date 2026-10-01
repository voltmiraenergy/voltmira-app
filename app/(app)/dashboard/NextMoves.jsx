"use client";
// app/(app)/dashboard/NextMoves.jsx — the ranked "what to do next" list.
//
// The ranking is computed on the server (lib/dashboardMoves.js); this only
// filters it by tab, runs the one-tap actions through the same server actions
// the rest of the app uses, and remembers "done for today" per browser. That
// last part is deliberately local: it is a personal to-do tick, not a change
// to the quote, so it resets on its own the next morning.
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setLeadStatus, createProjectFromLead, setInstallStep } from "../../../lib/actions.js";

const STORE = "vm_dx_done";
const VISIBLE = 6;

const P = {
  eye: <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>,
  flame: <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />,
  cal: <><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></>,
  userPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></>,
  play: <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />,
  receipt: <><path d="M13 16H8" /><path d="M14 8H8" /><path d="M16 12H8" /><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" /></>,
  mail: <><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6h4" /></>,
  pen: <><path d="M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z" /></>,
  down: <><path d="M16 17h6v-6" /><path d="m22 17-8.5-8.5-5 5L2 7" /></>,
  pulse: <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />,
  check: <path d="M20 6 9 17l-5-5" />,
  phone: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />,
};
const KIND_ICON = {
  live: "eye", hot: "flame", followup: "cal", lead: "userPlus", visit: "cal", visit_done: "pen", won_start: "play", install: "wrench",
  invoice: "receipt", unopened: "mail", quiet: "clock", draft: "pen", health: "down", nodata: "pulse", grid: "phone",
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

export default function NextMoves({ moves, labels, todayKey }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState(null);
  const [tab, setTab] = useState("all");
  const [more, setMore] = useState(false);
  const [done, setDone] = useState({});
  useEffect(() => { setDone(readDone(todayKey)); }, [todayKey]);

  const saveDone = (next) => {
    setDone(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  };

  const active = moves.filter((m) => !done[m.key]);
  const hiddenN = moves.length - active.length;
  const counts = useMemo(() => {
    const c = { all: active.length, sales: 0, leads: 0, jobs: 0, systems: 0 };
    for (const m of active) c[m.group] = (c[m.group] || 0) + 1;
    return c;
  }, [active]);
  const list = tab === "all" ? active : active.filter((m) => m.group === tab);
  const shown = more ? list : list.slice(0, VISIBLE);

  function run(m, a) {
    setBusyKey(m.key + a.type);
    start(async () => {
      try {
        if (a.type === "lead_quote") {
          const pid = await createProjectFromLead(a.id);
          if (pid) { router.push(`/projects/${pid}`); return; }
        } else if (a.type === "lead_contacted") {
          await setLeadStatus(a.id, "contacted");
        } else if (a.type === "step") {
          await setInstallStep(a.projectId, a.step, true);
        }
        router.refresh();
      } finally { setBusyKey(null); }
    });
  }

  const tabs = ["all", "sales", "leads", "jobs", "systems"].filter((k) => k === "all" || counts[k] > 0);

  return (
    <section className="dx-card dx-moves" aria-labelledby="dx-moves-h">
      <header className="dx-card-head">
        <div>
          <h2 id="dx-moves-h">{labels.title}<span className="dx-count">{active.length}</span></h2>
          <p>{labels.sub}</p>
        </div>
      </header>

      {tabs.length > 2 && (
        <div className="dx-tabs" role="tablist" aria-label={labels.title}>
          {tabs.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""}
              onClick={() => { setTab(k); setMore(false); }}>
              {labels.tabs[k]}<span>{counts[k]}</span>
            </button>
          ))}
        </div>
      )}

      {shown.length ? (
        <ol className="dx-move-list">
          {shown.map((m) => (
            <li key={m.key} className={"dx-move k-" + m.kind}>
              <span className="dx-move-ic" aria-hidden="true">
                <Svg d={KIND_ICON[m.kind] || "pulse"} />
              </span>
              <div className="dx-move-body">
                <div className="dx-move-meta">
                  <span className="dx-kind">{labels.kinds[m.kind]}</span>
                  {m.hot && <span className="dx-hot">{labels.hot}</span>}
                  {m.ago && <time>{m.ago}</time>}
                </div>
                <div className="dx-move-who">
                  <Link href={m.href} className="dx-move-title">{m.title}</Link>
                  {m.sub && <span className="dx-move-sub">{m.sub}</span>}
                </div>
                <p className="dx-move-reason">{rich(m.reason)}</p>
                {m.note && <p className="dx-move-note">{m.note}</p>}
                <div className="dx-move-actions">
                  {m.actions.map((a, i) => {
                    const cls = "dx-btn" + (i === 0 ? " primary" : "");
                    if (a.type === "link") return <Link key={i} href={a.href} className={cls}>{a.label}</Link>;
                    if (a.type === "tel") return <a key={i} href={`tel:${a.phone.replace(/\s+/g, "")}`} className={cls + " call"}><Svg d="phone" size={14} />{a.label}</a>;
                    const busy = pending && busyKey === m.key + a.type;
                    return (
                      <button key={i} type="button" className={cls} disabled={pending} aria-busy={busy} onClick={() => run(m, a)}>
                        {a.type === "step" && <Svg d="check" size={14} w={2.6} />}{a.label}
                      </button>
                    );
                  })}
                </div>
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

      {(list.length > VISIBLE || hiddenN > 0) && (
        <footer className="dx-moves-foot">
          {list.length > VISIBLE
            ? <button type="button" className="dx-link" onClick={() => setMore((v) => !v)}>
                {more ? labels.less : labels.more.replace("{n}", String(list.length - VISIBLE))}
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
