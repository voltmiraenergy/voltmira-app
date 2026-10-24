// app/(app)/jobs/page.jsx — "Lucrări": every signed job on one board by install step, the crews' week with their
// visits (docs/features/phase3.md), and "Încasări", the clients' payments in stages (docs/features/phase4.md). The data comes from lib/jobActions.js loadJobs; the page is the view.
import "../dx.css";
import "./jobs.css";
import { loadJobs } from "../../../lib/jobActions.js";
import { loadCash } from "../../../lib/cashActions.js";
import { appTitle } from "../../../lib/pageTitle.js";
import JobsView from "./JobsView.jsx";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("nav_jobs");

export default async function JobsPage(props) {
  const sp = await props.searchParams;
  // the board and the week, and "Încasări": what the clients owe and paid (lib/cashActions.js, docs/features/phase4.md)
  const [data, cash] = await Promise.all([loadJobs({ monday: sp?.week || null }), loadCash()]);
  const tab = ["week", "cash"].includes(sp?.view) ? sp.view : "board";
  return <JobsView data={data} cash={cash} tab={tab} />;
}
