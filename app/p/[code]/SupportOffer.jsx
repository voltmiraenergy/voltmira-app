// app/p/[code]/SupportOffer.jsx — the support programmes the client may get,
// as frozen with the offer on the day it was issued (lib/supportSnapshot.js):
// what applies or applies once a condition is confirmed, an estimate in lei,
// and the documents still missing. Amounts stay in lei, the currency the
// programmes set them in. Server-rendered; older offers have no support and
// show nothing.
import { ppt } from "./text.js";
import { moneyFormatter } from "../../../lib/money.js";
import { fmtDate } from "../../../lib/tz.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/** The "Estimated support" line, also used in the financing section. */
export function supportLine(support, lang, { costMdl = 0 } = {}) {
  const t = support?.totals;
  if (!t || !(t.upToMinor > 0)) return null;
  const L = moneyFormatter({ currency: "MDL", lang, fx: { MDL: 1 } });
  const head = t.upToMinor > t.sureMinor
    ? (t.sureMinor > 0 ? ppt("sup_total_upto", lang, { a: L(t.sureMinor / 100), b: L(t.upToMinor / 100) }) : ppt("sup_total", lang, { x: ppt("sup_up_to", lang, { x: L(t.upToMinor / 100) }) }))
    : ppt("sup_total", lang, { x: L(t.sureMinor / 100) });
  const net = t.sureMinor > 0 && costMdl > 0 ? ppt("sup_net", lang, { x: L(costMdl - t.sureMinor / 100) }) : null;
  return { head, net };
}

export default function SupportOffer({ support, lang, costMdl = 0 }) {
  const items = support?.results || [];
  if (!items.length) return null;
  const L = moneyFormatter({ currency: "MDL", lang, fx: { MDL: 1 } });
  const day = (d) => fmtDate(`${d}T12:00:00Z`, LOC[lang] || "ro-RO", { day: "numeric", month: "long", year: "numeric" });
  const line = supportLine(support, lang, { costMdl });

  const amount = (r) => {
    if (r.kind === "guarantee" && r.estimateMinor > 0) return ppt("sup_guarantee", lang, { x: L(r.estimateMinor / 100) });
    if (r.estimateMinor > 0) return ppt(r.upTo || r.status !== "eligible" ? "sup_up_to" : "sup_about", lang, { x: L(r.estimateMinor / 100) });
    if (r.fromPct != null) return ppt("sup_duty", lang, { a: r.fromPct, b: r.toPct });
    return "";
  };

  return (
    <section className="pp-sec" aria-labelledby="pp-sup-h">
      <h2 className="pp-h2" id="pp-sup-h">{ppt("sup_h", lang)}</h2>
      <p className="pp-lead">{ppt("sup_sub", lang, { d: day(support.asOf) })}</p>
      <ul className="pp-sup">
        {items.map((r) => (
          <li key={r.code} className={"pp-card pp-sup-i " + (r.status === "eligible" ? "is-ok" : "is-open")}>
            <div className="pp-sup-top">
              <b>{r.name?.[lang] || r.name?.en}</b>
              <span className="pp-sup-st">{ppt(r.status === "eligible" ? "sup_eligible" : "sup_conditional", lang)}</span>
            </div>
            {amount(r) && <p className="pp-sup-amt">{amount(r)}{r.validTo ? `, ${ppt("sup_until", lang, { d: day(r.validTo) })}` : ""}</p>}
            {r.status === "conditional" && r.reasons?.length > 0 && (
              <p className="pp-sup-why">{r.reasons.map((x) => ppt("sup_r_" + x, lang)).filter((s) => !s.startsWith("sup_r_")).join("; ")}</p>
            )}
            {r.requiredDocs?.length > 0 && (r.missingDocs?.length ? (
              <div className="pp-sup-docs">
                <span>{ppt("sup_docs", lang)}</span>
                <ul>{r.missingDocs.map((d) => <li key={d.id}>{d.name?.[lang] || d.name?.en}</li>)}</ul>
              </div>
            ) : <p className="pp-sup-why">{ppt("sup_docs_ok", lang)}</p>)}
          </li>
        ))}
      </ul>
      {line && <p className="pp-sup-total"><b>{line.head}</b>{line.net ? <><br />{line.net}</> : null}</p>}
    </section>
  );
}
