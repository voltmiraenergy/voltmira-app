"use client";
// app/(app)/dashboard/DashTabs.jsx — the dashboard's book in one card: recent
// quotes, new leads, jobs being installed, paperwork and activity, one tab at
// a time instead of five stacked sections. The panels are rendered on the
// server (page.jsx) and handed in as `tabs[].content`; this only switches
// between them and remembers the last one this browser opened.
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "voltmira_dash_tab";

export default function DashTabs({ tabs, label }) {
  const [on, setOn] = useState(tabs[0]?.id);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && tabs.some((t) => t.id === saved)) setOn(saved);
    } catch { /* storage blocked: start on the first tab */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (id) => {
    setOn(id);
    try { localStorage.setItem(KEY, id); } catch { /* not remembered, still switches */ }
  };
  const cur = tabs.find((t) => t.id === on) || tabs[0];
  if (!cur) return null;

  return (
    <section className="dx-card dx-book" aria-label={label}>
      <header className="dx-book-head">
        <div className="dx-tabs" role="tablist" aria-label={label}>
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" id={"dx-book-" + t.id} aria-selected={t.id === cur.id} aria-controls="dx-book-panel"
              className={t.id === cur.id ? "on" : ""} onClick={() => pick(t.id)}>
              {t.label}{t.count != null && <span>{t.count}</span>}
            </button>
          ))}
        </div>
        {cur.href && <Link className="dx-link" href={cur.href}>{cur.linkLabel}</Link>}
      </header>
      <div id="dx-book-panel" role="tabpanel" aria-labelledby={"dx-book-" + cur.id}>
        {cur.note && <p className="dx-book-note">{cur.note}</p>}
        {cur.content}
      </div>
    </section>
  );
}
