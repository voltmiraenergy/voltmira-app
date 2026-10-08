// app/d/[token]/summary/page.jsx — the credit summary alone, through a bank's
// link: what /api/deal/[token]/pack renders to PDF (?pdf=1), and a clean page
// to print. The same document and set-up as /portfolios/[id]/bank.
import "../../../(app)/dx.css";
import "../../../(app)/portfolios/portfolio.css";
import "../../../(app)/portfolios/[id]/report/report.css";
import "../deal.css";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import AppTheme from "../../../(app)/AppTheme.jsx";
import HtmlLang from "../../../../lib/HtmlLang.jsx";
import CreditSummary from "../../../(app)/portfolios/[id]/bank/CreditSummary.jsx";
import PrintButton from "../../../(app)/portfolios/[id]/report/PrintButton.jsx";
import { loadDeal, logView } from "../../../../lib/dealLoad.js";
import { docSetup, printCss } from "../../../../lib/portfolioPrint.js";
import { normalizePlant } from "../../../../lib/plantFinance.js";
import { bt } from "../../../../lib/bankText.js";
import { pt } from "../../../../lib/portfolioText.js";
import { LINK_LANGS, docCounts } from "../../../../lib/dealRoom.js";
import { mdDayKey } from "../../../../lib/tz.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credit summary | VoltMira", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const todayKey = () => mdDayKey(Date.now());

export default async function DealSummary(props) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const d = await loadDeal(token);
  if (d.state !== "active") notFound();
  const lang = LINK_LANGS.includes(sp?.lang) ? sp.lang : d.link.lang;
  const { pdf, money, date } = docSetup({ ...sp, lang }, d);
  // the pack's own render is logged as the pack; a person reading it here is logged as such
  if (!pdf) await logView(d.link, "summary", "", await headers());
  const name = normalizePlant(d.model.assets[0].plant).name;
  return (
    <div className="app dl-app dl-print">
      <AppTheme />
      <HtmlLang lang={lang} />
      <main className="main"><div className="view dl-view">
        <div className={"rp-wrap" + (pdf ? " is-pdf" : "")}>
          {!pdf && <div className="rp-bar"><PrintButton label={pt("r_print", lang)} /></div>}
          <CreditSummary model={d.model} lang={lang} company={d.co?.name || ""} date={date} money={money} fx={d.fx} todayKey={todayKey()} docCounts={docCounts(d.docs)} />
          <style>{printCss({ lang, title: `${name}, ${bt("title", lang)}` })}</style>
        </div>
      </div></main>
    </div>
  );
}
