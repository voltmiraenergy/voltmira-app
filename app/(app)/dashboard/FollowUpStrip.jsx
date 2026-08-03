"use client";
// app/(app)/dashboard/FollowUpStrip.jsx — the "needs follow-up" reminders. Each
// row can now be dismissed (✓ Done): it animates out, then snoozes for a week so
// reminders stop piling up. Managed locally for instant, animated removal.
import { useState, useTransition } from "react";
import Link from "next/link";
import { snoozeFollowUp } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function FollowUpStrip({ items: initial, lang }) {
  const [items, setItems] = useState(initial);
  const [closing, setClosing] = useState({});   // id -> true while animating out
  const [, start] = useTransition();

  if (items.length === 0) return null;

  function dismiss(id) {
    setClosing(c => ({ ...c, [id]: true }));
    // let the CSS transition play, then remove + persist the snooze
    setTimeout(() => {
      setItems(list => list.filter(x => x.id !== id));
      start(() => snoozeFollowUp(id));
    }, 320);
  }

  return (
    <section className="followup-strip">
      <h3>☀ {t("today_title", lang)}</h3>
      <div className="fu-sub">{t("today_sub", lang)}</div>
      {items.map(({ id, title, client, reason }) => (
        <div className="fu-row" key={id}
          style={{
            maxHeight: closing[id] ? 0 : 84, opacity: closing[id] ? 0 : 1,
            transform: closing[id] ? "translateX(24px)" : "none",
            marginBottom: closing[id] ? 0 : undefined,
            paddingTop: closing[id] ? 0 : undefined, paddingBottom: closing[id] ? 0 : undefined,
            overflow: "hidden",
            transition: "max-height .32s ease, opacity .28s ease, transform .32s ease, padding .32s ease",
          }}>
          <div className="fu-who">
            <b>{title || t("untitled", lang)}</b>
            <span>{client || "—"} · {reason}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link className="btn sm amber" href={`/projects/${id}`}>{t("ttl_open", lang)}</Link>
            <button className="btn sm ghost" onClick={() => dismiss(id)} aria-label={t("fu_done", lang)} title={t("fu_done", lang)}>
              ✓ {t("fu_done", lang)}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
