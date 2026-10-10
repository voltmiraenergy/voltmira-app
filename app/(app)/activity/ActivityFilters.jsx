"use client";
// app/(app)/activity/ActivityFilters.jsx — the "whose actions" picker in the
// Activity header. Search and type live in the server page (a GET form and
// tab links); this only needs a client to navigate the moment a person is picked.
import { useRouter } from "next/navigation";
import { t } from "../../../lib/i18n.js";

export default function ActivityFilters({ q, who, type, members, lang }) {
  const router = useRouter();
  function go(nextWho) {
    const parts = [];
    if (q) parts.push("q=" + encodeURIComponent(q));
    if (nextWho && nextWho !== "all") parts.push("who=" + nextWho);
    if (type && type !== "all") parts.push("type=" + type);
    router.push("/activity" + (parts.length ? "?" + parts.join("&") : ""));
  }
  return (
    <select className="input ax-who-sel" value={who} onChange={(e) => go(e.target.value)} aria-label={t("act_people_h", lang)}>
      <option value="all">{t("act_who_all", lang)}</option>
      {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
    </select>
  );
}
