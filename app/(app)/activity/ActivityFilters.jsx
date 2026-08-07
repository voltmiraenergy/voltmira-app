"use client";
// app/(app)/activity/ActivityFilters.jsx — search, filter by person, filter by
// type. All state travels in the query string (the server page does the work).
import { useRouter } from "next/navigation";
import { t } from "../../../lib/i18n.js";

const TYPES = ["all", "quote", "proposal", "lead", "sys", "won"];
const TYPE_LABEL = { all: "act_type_all", quote: "act_type_quote", proposal: "act_type_proposal", lead: "act_type_lead", sys: "act_type_settings", won: "act_type_won" };

export default function ActivityFilters({ q, who, type, members, lang }) {
  const router = useRouter();
  function go(next) {
    const s = { q, who, type, ...next };
    const parts = [];
    if (s.q) parts.push("q=" + encodeURIComponent(s.q));
    if (s.who && s.who !== "all") parts.push("who=" + s.who);
    if (s.type && s.type !== "all") parts.push("type=" + s.type);
    router.push("/activity" + (parts.length ? "?" + parts.join("&") : ""));
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input className="input" defaultValue={q} placeholder={t("act_search", lang)} style={{ flex: 1, minWidth: 160 }}
          onKeyDown={e => { if (e.key === "Enter") go({ q: e.currentTarget.value }); }} />
        <select className="input" value={who} onChange={e => go({ who: e.target.value })} style={{ minWidth: 150 }}>
          <option value="all">{t("act_who_all", lang)}</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {TYPES.map(ty => (
          <button key={ty} className={"fchip" + (type === ty ? " on" : "")} onClick={() => go({ type: ty })}>
            {t(TYPE_LABEL[ty], lang)}
          </button>
        ))}
      </div>
    </div>
  );
}
