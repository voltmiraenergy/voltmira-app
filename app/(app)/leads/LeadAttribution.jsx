// app/(app)/leads/LeadAttribution.jsx — the "which channel is paying off" panel.
// Server component: given every lead, it groups by marketing channel and shows
// total leads + how many converted, sorted so the best-performing channel leads.
//
// One compact row per channel: a bar for its share of all leads, with the part
// that became a quote filled in, so volume and quality read in the same glance.
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
  const max = Math.max(...rows.map((r) => r.total));
  const totalWon = rows.reduce((s, r) => s + r.won, 0);

  return (
    <section className="dx-card ld-attr" aria-labelledby="ld-attr-h">
      <header className="dx-card-head">
        <div>
          <h2 id="ld-attr-h">{t("lead_attribution", lang)}</h2>
          <p>{t("lead_attr_hint", lang)}</p>
        </div>
      </header>
      <div className="ld-attr-cols" aria-hidden="true">
        <span />
        <span>{t("lead_attr_col_n", lang)}</span>
        <span>{t("lead_attr_col_q", lang)}</span>
      </div>
      <ul className="ld-attr-list">
        {rows.map((r) => (
          <li key={r.k}>
            <div className="ld-attr-top">
              <span className="ld-attr-ch"><i style={{ background: CHANNEL_DOT[r.k] }} aria-hidden="true" />{t("lead_ch_" + r.k, lang)}</span>
              <b className="ld-attr-n">{r.total}</b>
              <span className={"ld-attr-won" + (r.won ? " on" : "")}>
                {r.won ? `${r.won} (${Math.round((r.won / r.total) * 100)}%)` : "0"}
              </span>
            </div>
            <span className="ld-attr-bar" aria-hidden="true">
              <i style={{ width: (r.total / max) * 100 + "%", color: CHANNEL_DOT[r.k] }}>
                <b style={{ width: r.total ? (r.won / r.total) * 100 + "%" : 0 }} />
              </i>
            </span>
          </li>
        ))}
      </ul>
      {totalWon === 0 && <p className="dx-muted-note ld-attr-note">{t("lead_attr_none_all", lang)}</p>}
    </section>
  );
}
