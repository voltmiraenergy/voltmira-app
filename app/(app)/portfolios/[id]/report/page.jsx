// app/(app)/portfolios/[id]/report/page.jsx — the bankability report page. The
// PDF route (/api/portfolios/[id]/report) captures it in headless Chromium with
// ?pdf=1; opened directly it is an on-screen preview with a print button.
// Auth-scoped like every (app) page: the headless browser replays the caller's
// own session, so it can never show more than they may see.
import "../../../dx.css";
import "../../portfolio.css";
import "./report.css";
import { notFound, redirect } from "next/navigation";
import { loadPortfolio } from "../../../../../lib/portfolioLoad.js";
import { buildModel } from "../../../../../lib/portfolioModel.js";
import { pt } from "../../../../../lib/portfolioText.js";
import Report from "./Report.jsx";
import PrintButton from "./PrintButton.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bankability report | VoltMira" };

const REPORT_LANGS = ["en", "uk", "ro", "ru"];

export default async function ReportPage(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const d = await loadPortfolio(id);
  if (d.state === "unauthorized") redirect("/login");
  if (d.state !== "ok") notFound();
  const lang = REPORT_LANGS.includes(sp?.lang) ? sp.lang : "en";
  const pdf = sp?.pdf === "1";
  const model = buildModel({ portfolio: d.portfolio, projects: d.quotes, E: d.E, schemeLimitKw: d.schemeLimitKw });
  const date = new Intl.DateTimeFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang], { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return (
    <div className={"rp-wrap" + (pdf ? " is-pdf" : "")}>
      {!pdf && <div className="rp-bar"><PrintButton label={pt("r_print", lang)} /></div>}
      <Report model={model} lang={lang} company={d.co?.name || ""} date={date} />
      <style>{`
        @media print {
          .sidebar, .skip-link, .demo-bar, .offline-bar, .rp-bar { display: none !important; }
          .app .main { margin: 0 !important; padding: 0 !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
    </div>
  );
}
