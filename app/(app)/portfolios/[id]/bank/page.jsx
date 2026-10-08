// app/(app)/portfolios/[id]/bank/page.jsx — the credit summary of one plant
// (?plant=<id>), the first document of the bank submission pack. The pack
// route (/api/portfolios/[id]/bankpack) captures it with ?pdf=1, once in
// Romanian and once in English; opened directly it is an on-screen preview
// with a print button. Auth-scoped like every (app) page.
import "../../../dx.css";
import "../../portfolio.css";
import "../report/report.css";
import { notFound, redirect } from "next/navigation";
import { loadPortfolio } from "../../../../../lib/portfolioLoad.js";
import { buildModel } from "../../../../../lib/portfolioModel.js";
import { plantOnly } from "../../../../../lib/bankPack.js";
import { normalizePlant } from "../../../../../lib/plantFinance.js";
import { bt } from "../../../../../lib/bankText.js";
import { pt } from "../../../../../lib/portfolioText.js";
import { docSetup, printCss } from "../../../../../lib/portfolioPrint.js";
import { mdDayKey } from "../../../../../lib/tz.js";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { docCounts, ITEM_IDS } from "../../../../../lib/dealRoom.js";
import CreditSummary from "./CreditSummary.jsx";
import PrintButton from "../report/PrintButton.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credit summary | VoltMira" };

/** Today in Moldova, for what is overdue on the checklist. */
const todayKey = () => mdDayKey(Date.now());

export default async function BankPage(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const d = await loadPortfolio(id);
  if (d.state === "unauthorized") redirect("/login");
  if (d.state !== "ok") notFound();
  const one = plantOnly(d.portfolio, sp?.plant);
  if (!one) notFound();
  const { lang, pdf, money, date } = docSetup(sp, d);
  // the summary shows no tornado or structure comparison: skip those runs
  const model = buildModel({ portfolio: one, projects: [], E: d.E, schemeLimitKw: d.schemeLimitKw, include: { sensitivity: false, structures: false } });
  if (!model.assets.length) notFound();
  const name = normalizePlant(model.assets[0].plant).name;
  // the documents on file, to mark the checklist; none where the deal room is not set up
  const sb = await supabaseServer();
  const { data: docs, error: docErr } = await sb.from("deal_documents").select("item_id").eq("portfolio_id", id).eq("plant_id", String(sp?.plant || ""));
  const counts = docErr ? null : docCounts((docs || []).filter((x) => ITEM_IDS.includes(x.item_id)));
  return (
    <div className={"rp-wrap" + (pdf ? " is-pdf" : "")}>
      {!pdf && sp?.fallback === "1" && <p className="rp-fallback" role="status">{pt("r_pdf_fallback", lang)}</p>}
      {!pdf && <div className="rp-bar"><PrintButton label={pt("r_print", lang)} /></div>}
      <CreditSummary model={model} lang={lang} company={d.co?.name || ""} date={date} money={money} fx={d.fx} todayKey={todayKey()} docCounts={counts} />
      <style>{printCss({ lang, title: `${name}, ${bt("title", lang)}` })}</style>
    </div>
  );
}
