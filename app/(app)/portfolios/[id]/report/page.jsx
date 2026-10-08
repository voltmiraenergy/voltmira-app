// app/(app)/portfolios/[id]/report/page.jsx — the bankability report page. The
// PDF route (/api/portfolios/[id]/report) captures it in headless Chromium with
// ?pdf=1; opened directly it is an on-screen preview with a print button.
// Auth-scoped like every (app) page: the headless browser replays the caller's
// own session, so it can never show more than they may see. ?cur=MDL|UAH shows
// the amounts in that currency at the live rate, stated in the document.
import "../../../dx.css";
import "../../portfolio.css";
import "./report.css";
import { notFound, redirect } from "next/navigation";
import { loadPortfolio } from "../../../../../lib/portfolioLoad.js";
import { buildModel } from "../../../../../lib/portfolioModel.js";
import { pt } from "../../../../../lib/portfolioText.js";
import { docSetup, printCss } from "../../../../../lib/portfolioPrint.js";
import Report from "./Report.jsx";
import PrintButton from "./PrintButton.jsx";
import { mdDayKey } from "../../../../../lib/tz.js";
import { bt } from "../../../../../lib/bankText.js";
import { reportId } from "../../../../../lib/reportId.js";

/** Today in Moldova, for the report ID. */
const todayKey = () => mdDayKey(Date.now());

export const dynamic = "force-dynamic";
export const metadata = { title: "Bankability report | VoltMira" };

export default async function ReportPage(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const d = await loadPortfolio(id);
  if (d.state === "unauthorized") redirect("/login");
  if (d.state !== "ok") notFound();
  const { lang, pdf, money, date } = docSetup(sp, d);
  const model = buildModel({ portfolio: d.portfolio, projects: d.quotes, E: d.E, schemeLimitKw: d.schemeLimitKw });
  const rid = reportId(model, todayKey());
  return (
    <div className={"rp-wrap" + (pdf ? " is-pdf" : "")}>
      {!pdf && sp?.fallback === "1" && <p className="rp-fallback" role="status">{pt("r_pdf_fallback", lang)}</p>}
      {!pdf && <div className="rp-bar"><PrintButton label={pt("r_print", lang)} /></div>}
      <Report model={model} lang={lang} company={d.co?.name || ""} date={date} money={money} fx={d.fx} rid={rid} />
      <style>{printCss({ lang, title: `${d.portfolio?.name || ""}, ${pt("r_title", lang)}, ${bt("rid", lang, { x: rid })}` })}</style>
    </div>
  );
}
