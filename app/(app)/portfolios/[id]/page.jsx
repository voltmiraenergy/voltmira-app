// app/(app)/portfolios/[id]/page.jsx — one portfolio: the numbers a lender asks
// for, the stress cases, the risk matrix, the document register, the E&S
// screening, and the exports. The server loads rows (lib/portfolioLoad.js); the
// client view computes everything from them (lib/portfolioModel.js), so editing
// an assumption recalculates at once.
import "../../dx.css";
import "../portfolio.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPortfolio } from "../../../../lib/portfolioLoad.js";
import { pt } from "../../../../lib/portfolioText.js";
import PortfolioView from "./PortfolioView.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio | VoltMira" };

export default async function PortfolioPage(props) {
  const { id } = await props.params;
  const d = await loadPortfolio(id);
  if (d.state === "unauthorized") redirect("/login");
  if (d.state !== "ok") {
    return (
      <div className="dx pf">
        <Link href="/portfolios" className="pf-back">{pt("back", d.lang)}</Link>
        <section className="card"><p className="pf-warn" role="alert">{pt(d.state === "needs_db" ? "needs_db" : "not_found", d.lang)}</p></section>
      </div>
    );
  }
  return <PortfolioView portfolio={d.portfolio} quotes={d.quotes} E={d.E} lang={d.lang} schemeLimitKw={d.schemeLimitKw} company={d.co?.name || ""} />;
}
