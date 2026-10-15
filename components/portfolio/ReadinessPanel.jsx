// components/portfolio/ReadinessPanel.jsx — the bankability readiness score,
// its four parts and the next steps, biggest gain first (lib/portfolioReadiness.js).
// Server-renderable: the longer list opens with a native <details>, so it works
// by keyboard and in the PDF without any script.
import { pt } from "../../lib/portfolioText.js";
import { num } from "../../lib/portfolioFormat.js";
import { actionText } from "../../lib/portfolioDisplay.js";

export default function ReadinessPanel({ readiness, lang = "en", shown = 5, all = false }) {
  const r = readiness;
  const score = Math.round(r.score);
  const acts = r.actions || [];
  const first = all ? acts : acts.slice(0, shown);
  const rest = all ? [] : acts.slice(shown);
  const step = (a, i) => (
    <li key={a.id}>
      <i>{i + 1}.</i>
      <span>{actionText(a, lang)}</span>
      <b className="pf-gain" title={pt("rd_gain_h", lang)}>{pt("rd_gain", lang, { n: num(a.gain, lang, 1) })}</b>
    </li>
  );
  return (
    <div className="pf-ready">
      <div className="pf-ready-score">
        <div className="pf-ready-num"><b>{score}</b><span>{pt("rd_of", lang)}</span></div>
        <div className="pf-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={pt("s_ready", lang)}>
          <i style={{ width: Math.max(0, Math.min(100, r.score)) + "%" }} />
        </div>
        <ul className="pf-parts">
          {r.parts.map((p) => (
            <li key={p.id}>
              <span>{pt("part_" + p.id, lang)}</span>
              {p.value == null ? <em>{pt("rd_not_counted", lang)}</em> : (
                <>
                  <span className="pf-meter sm" aria-hidden="true"><i style={{ width: p.value * 100 + "%" }} /></span>
                  <small>{pt("rd_points", lang, { p: num(p.points, lang, 0), m: num(p.max, lang, 0) })}</small>
                </>
              )}
            </li>
          ))}
        </ul>
        <details className="pf-rule-d">
          <summary>{pt("rd_rule_t", lang)}</summary>
          <p>{pt("rd_rule", lang)}</p>
        </details>
      </div>
      <div className="pf-ready-next">
        <h3>{pt("rd_next", lang)}</h3>
        {acts.length === 0 ? <p className="pf-hint">{pt("rd_done", lang)}</p> : (
          <>
            <ol className="pf-steps">{first.map(step)}</ol>
            {rest.length > 0 && (
              <details className="pf-more">
                <summary>{pt("rd_more", lang, { n: acts.length })}</summary>
                <ol className="pf-steps">{rest.map((a, i) => step(a, i + first.length))}</ol>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
