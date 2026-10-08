// app/(app)/portfolios/[id]/teaser/page.jsx — the investor teaser: two A4 pages
// for a first contact with a fund, beside the full report. The PDF route
// (/api/portfolios/[id]/teaser) captures it with ?pdf=1. Same model, same
// numbers as the report and the workbook (lib/portfolioModel.js).
import "../../../dx.css";
import "../../portfolio.css";
import "../report/report.css";
import { notFound, redirect } from "next/navigation";
import { loadPortfolio } from "../../../../../lib/portfolioLoad.js";
import { buildModel } from "../../../../../lib/portfolioModel.js";
import { pt } from "../../../../../lib/portfolioText.js";
import { docSetup, printCss } from "../../../../../lib/portfolioPrint.js";
import Teaser from "./Teaser.jsx";
import PrintButton from "../report/PrintButton.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor teaser | VoltMira" };

export default async function TeaserPage(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const d = await loadPortfolio(id);
  if (d.state === "unauthorized") redirect("/login");
  if (d.state !== "ok") notFound();
  const { lang, pdf, money, date } = docSetup(sp, d);
  // the teaser shows no sensitivity or structure tables: skip those runs
  const model = buildModel({ portfolio: d.portfolio, projects: d.quotes, E: d.E, schemeLimitKw: d.schemeLimitKw, include: { sensitivity: false, structures: false } });
  return (
    <div className={"rp-wrap" + (pdf ? " is-pdf" : "")}>
      {!pdf && sp?.fallback === "1" && <p className="rp-fallback" role="status">{pt("r_pdf_fallback", lang)}</p>}
      {!pdf && <div className="rp-bar"><PrintButton label={pt("r_print", lang)} /></div>}
      <Teaser model={model} lang={lang} company={d.co?.name || ""} date={date} money={money} fx={d.fx} />
      <style>{printCss({ lang, title: `${d.portfolio?.name || ""}, ${pt("t_title", lang)}` })}</style>
    </div>
  );
}
