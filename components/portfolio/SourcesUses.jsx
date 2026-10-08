// components/portfolio/SourcesUses.jsx — sources and uses at financial close:
// two small tables that balance, and one bar of the sources (part-to-whole).
// Server-renderable (the report uses it too).
//
// The bar follows the data-viz skill: three categorical slots in a fixed order,
// grant --pf-b | debt --pf-c | equity --pf-a, so the two hues that sit closest
// (amber and green) never touch; a 2px surface gap between segments; a share
// written inside a segment only when it fits; the legend and the tables carry
// every value.
import { pt } from "../../lib/portfolioText.js";
import { pct } from "../../lib/portfolioFormat.js";

export default function SourcesUses({ su, money, lang = "en" }) {
  const tot = su.sources.totalEur;
  const share = (v) => (tot > 0 ? v / tot : 0);
  const segs = [
    { k: "grant", cls: "pf-fb", label: pt("k_grant", lang), v: su.sources.grantEur },
    { k: "debt", cls: "pf-fc", label: pt("k_debt", lang), v: su.sources.debtEur },
    { k: "equity", cls: "pf-fa", label: pt("su_equity", lang), v: su.sources.equityEur },
  ].filter((s) => s.v > 0.5);
  const uTot = su.uses.totalEur;
  return (
    <div className="pf-su">
      <div className="pf-su-bar" role="img" aria-label={segs.map((s) => `${s.label} ${pct(share(s.v), lang, 0)}`).join(", ")}>
        {segs.map((s) => (
          <span key={s.k} className={"pf-su-seg " + s.cls} style={{ flexGrow: Math.max(share(s.v), 0.001) }} title={`${s.label}: ${money.full(s.v)} (${pct(share(s.v), lang, 1)})`}>
            {share(s.v) >= 0.12 && <em>{pct(share(s.v), lang, 0)}</em>}
          </span>
        ))}
      </div>
      <div className="pf-legend">
        {segs.map((s) => <span key={s.k}><i className={"pf-k pf-k-sw " + s.cls.replace("pf-f", "pf-k-")} />{s.label}</span>)}
      </div>
      <div className="pf-su-tables">
        <table className="pf-su-t">
          <thead><tr><th>{pt("su_uses", lang)}</th><th className="r">{money.cur}</th><th className="r">{pt("su_share", lang)}</th></tr></thead>
          <tbody>
            <tr><td>{pt("su_capex", lang)}</td><td className="r">{money.full(su.uses.capexEur)}</td><td className="r">{pct(uTot > 0 ? su.uses.capexEur / uTot : 0, lang, 1)}</td></tr>
            {su.uses.idcEur > 0.5 && <tr><td>{pt("su_idc", lang)}</td><td className="r">{money.full(su.uses.idcEur)}</td><td className="r">{pct(su.uses.idcEur / uTot, lang, 1)}</td></tr>}
            {su.uses.feeEur > 0.5 && <tr><td>{pt("su_fee", lang)}</td><td className="r">{money.full(su.uses.feeEur)}</td><td className="r">{pct(su.uses.feeEur / uTot, lang, 1)}</td></tr>}
            {su.uses.dsraEur > 0.5 && <tr><td>{pt("su_dsra", lang)}</td><td className="r">{money.full(su.uses.dsraEur)}</td><td className="r">{pct(su.uses.dsraEur / uTot, lang, 1)}</td></tr>}
          </tbody>
          <tfoot><tr><td>{pt("su_total", lang)}</td><td className="r">{money.full(uTot)}</td><td /></tr></tfoot>
        </table>
        <table className="pf-su-t">
          <thead><tr><th>{pt("su_sources", lang)}</th><th className="r">{money.cur}</th><th className="r">{pt("su_share", lang)}</th></tr></thead>
          <tbody>
            {su.sources.grantEur > 0.5 && <tr><td>{pt("k_grant", lang)}</td><td className="r">{money.full(su.sources.grantEur)}</td><td className="r">{pct(share(su.sources.grantEur), lang, 1)}</td></tr>}
            <tr><td>{pt("k_debt", lang)}</td><td className="r">{money.full(su.sources.debtEur)}</td><td className="r">{pct(share(su.sources.debtEur), lang, 1)}</td></tr>
            <tr><td>{pt("su_equity", lang)}</td><td className="r">{money.full(su.sources.equityEur)}</td><td className="r">{pct(share(su.sources.equityEur), lang, 1)}</td></tr>
          </tbody>
          <tfoot><tr><td>{pt("su_total", lang)}</td><td className="r">{money.full(tot)}</td><td /></tr></tfoot>
        </table>
      </div>
      <p className="pf-hint">{pt("su_h", lang)}</p>
    </div>
  );
}
