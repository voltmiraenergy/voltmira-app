// app/(app)/portfolios/deadlines/page.jsx — permits and deadlines across all
// the company's plants: what is late and what is due in the next 30 days
// (lib/deadlines.js), each row linking to its plant's checklist. The same
// list goes out by email on Mondays (lib/deadlineRun.js).
import "../../dx.css";
import "../portfolio.css";
import Link from "next/link";
import { supabaseServer } from "../../../../lib/supabase.js";
import { currentCompany } from "../../../../lib/session.js";
import { normLang } from "../../../../lib/i18n.js";
import { dlt, whenText } from "../../../../lib/deadlineText.js";
import { plt } from "../../../../lib/plantText.js";
import { collectDeadlines, SOON_DAYS } from "../../../../lib/deadlines.js";
import { itemName } from "../../../../lib/deadlineEmail.js";
import { PLANTS_KEY } from "../../../../lib/portfolioModel.js";
import { mdDayKey, fmtDate } from "../../../../lib/tz.js";
import { appTitle } from "../../../../lib/pageTitle.js";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle((lang) => dlt("title", lang));

/** Today in Moldova, for what is late. */
const todayKey = () => mdDayKey(Date.now());
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

function Table({ rows, lang }) {
  const loc = LOC[lang] || LOC.en;
  return (
    <div className="pf-scroll">
      <table className="pf-t dd-t">
        <thead><tr>
          <th>{dlt("c_plant", lang)}</th><th>{dlt("c_item", lang)}</th><th>{dlt("c_owner", lang)}</th><th>{dlt("c_ref", lang)}</th>
          <th className="r">{dlt("c_due", lang)}</th><th className="r">{dlt("c_when", lang)}</th><th />
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.plantId}-${r.item}-${r.step || ""}-${i}`} className={r.overdue ? "dd-late" : ""}>
              <td><b>{r.plantName || "-"}</b>{r.portfolioName ? <small>{r.portfolioName}</small> : null}</td>
              <td>{itemName(r, lang)}<small>{plt("ps_" + r.status, lang)}</small></td>
              <td>{r.by}</td>
              <td>{r.ref}</td>
              <td className="r nw">{fmtDate(r.due, loc, { day: "numeric", month: "short", year: "numeric" })}</td>
              <td className="r nw dd-when">{whenText(r.days, lang)}</td>
              <td className="r"><Link className="btn ghost sm" href={`/portfolios/${r.portfolioId}#plants`}>{dlt("open", lang)}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DeadlinesPage() {
  const sb = await supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const { data: portfolios, error } = await sb.from("portfolios").select("id, name, assets").order("updated_at", { ascending: false });
  const needsDb = !!error && /portfolios|schema cache|does not exist/i.test(error.message || "");
  const d = collectDeadlines(portfolios || [], todayKey());
  const hasPlants = (portfolios || []).some((p) => Array.isArray(p.assets?.[PLANTS_KEY]) && p.assets[PLANTS_KEY].length);
  const late = d.rows.filter((r) => r.overdue);
  const soon = d.rows.filter((r) => !r.overdue);

  return (
    <div className="dx pf">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{dlt("title", lang)}</h1>
          <p className="dx-summary">{dlt("sub", lang, { n: SOON_DAYS })}</p>
        </div>
        <Link className="btn ghost" href="/portfolios">{dlt("back", lang)}</Link>
      </header>

      {needsDb ? (
        <section className="card"><p className="pf-warn" role="alert">{dlt("needs_db", lang)}</p></section>
      ) : !hasPlants ? (
        <section className="card"><p>{dlt("no_plants", lang)}</p></section>
      ) : (
        <>
          {late.length > 0 && (
            <section className="card" aria-labelledby="dd-late-h">
              <div className="dx-card-head"><div><h2 id="dd-late-h">{dlt("late_h", lang)} <span className="dx-count">{late.length}</span></h2></div></div>
              <Table rows={late} lang={lang} />
            </section>
          )}
          <section className="card" aria-labelledby="dd-soon-h">
            <div className="dx-card-head"><div><h2 id="dd-soon-h">{dlt("soon_h", lang, { n: SOON_DAYS })} <span className="dx-count">{soon.length}</span></h2></div></div>
            {soon.length ? <Table rows={soon} lang={lang} /> : <p>{dlt("none", lang, { n: SOON_DAYS })}</p>}
          </section>
          {d.undated > 0 && <p className="pf-hint">{dlt("undated", lang, { n: d.undated })}</p>}
        </>
      )}
    </div>
  );
}
