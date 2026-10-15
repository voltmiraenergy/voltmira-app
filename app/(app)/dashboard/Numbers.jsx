// app/(app)/dashboard/Numbers.jsx — the "Numbers" tab of the dashboard book:
// the whole-book vitals on the left, and on the right the installer's own last
// 30 days against the 30 before (lib/workflow.js periodCompare). Server
// component: numbers in, markup out; nothing here is illustrative.
import { wt, durText } from "../../../lib/workflowText.js";

/** "62%" or "none yet" */
const pct = (r, lang) => (r == null ? wt("m_none", lang) : Math.round(r * 100) + "%");
const days = (d, lang) => (d == null ? wt("m_none", lang) : d < 1 ? wt("m_sameday", lang) : durText(Math.round(d), lang));

export default function Numbers({ vitals, vitalsTitle, period, lang, fmt }) {
  const { cur, prev } = period;
  return (
    <div className="dx-numbers">
      <div>
        <h3>{vitalsTitle}</h3>
        <dl className="dx-vlist">
          {vitals.map((v) => (
            <div key={v.label}><dt>{v.label}<small>{v.sub}</small></dt><dd>{v.value}</dd></div>
          ))}
        </dl>
      </div>
      <div>
        <h3>{wt("pp_month", lang)}</h3>
        <p className="dx-numbers-sub">{wt("pp_month_sub", lang)}</p>
        <dl className="dx-vlist">
          <div>
            <dt>{wt("m_sent", lang)}<small>{wt("m_prev", lang, { v: prev.sent })}</small></dt>
            <dd>{cur.sent}</dd>
          </div>
          <div>
            <dt>
              {wt("m_rate", lang)}
              {cur.open > 0 && <small>{wt("m_rate_s", lang, { open: cur.open })}</small>}
              <small>{wt("m_prev", lang, { v: pct(prev.rate, lang) })}</small>
            </dt>
            <dd>{pct(cur.rate, lang)}</dd>
          </div>
          <div>
            <dt>{wt("m_ttq", lang)}<small>{wt("m_ttq_s", lang)}</small><small>{wt("m_prev", lang, { v: days(prev.quoteDays, lang) })}</small></dt>
            <dd>{days(cur.quoteDays, lang)}</dd>
          </div>
          <div>
            <dt>
              {wt("m_online", lang)}
              <small>{wt("m_online_s", lang, { n: cur.online })}</small>
              <small>{wt("m_prev", lang, { v: prev.onlineValue > 0 ? fmt(prev.onlineValue) : prev.online })}</small>
            </dt>
            <dd>{cur.onlineValue > 0 ? fmt(cur.onlineValue) : cur.online}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
