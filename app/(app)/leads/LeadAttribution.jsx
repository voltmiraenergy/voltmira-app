// app/(app)/leads/LeadAttribution.jsx — the "which channel is paying off" panel.
// Server component: given every lead, it groups by marketing channel and shows
// total leads + how many converted, sorted so the best-performing channel leads.
import { t } from "../../../lib/i18n.js";
import { CHANNEL_ORDER, CHANNEL_DOT, leadChannel } from "../../../lib/leadChannels.js";

export default function LeadAttribution({ leads, lang }) {
  if (!leads.length) return null;

  const by = {};
  for (const l of leads) {
    const ch = leadChannel(l);
    const b = by[ch] || (by[ch] = { total: 0, won: 0 });
    b.total++;
    if (l.status === "converted") b.won++;
  }

  // Only channels that actually have leads, best conversion first (then volume).
  const rows = CHANNEL_ORDER
    .filter(k => by[k])
    .map(k => ({ k, ...by[k] }))
    .sort((a, b) => (b.won - a.won) || (b.total - a.total));

  return (
    <div className="card" style={{ padding: "16px 18px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 13 }}>
        <b style={{ fontSize: 14.5 }}>{t("lead_attribution", lang)}</b>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("lead_attr_hint", lang)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
        {rows.map(r => {
          const won = r.won > 0;
          return (
            <div key={r.k} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px",
              background: "var(--paper-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", flex: "none",
                  background: CHANNEL_DOT[r.k], boxShadow: `0 0 0 3px ${CHANNEL_DOT[r.k]}22` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("lead_ch_" + r.k, lang)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--ink)" }}>{r.total}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("lead_attr_leads", lang, { n: r.total })}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600,
                color: won ? "var(--green)" : "var(--muted)" }}>
                {won ? `✓ ${t("lead_attr_won", lang, { n: r.won })}` : t("lead_attr_none", lang)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
