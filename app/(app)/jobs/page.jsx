// app/(app)/jobs/page.jsx — "Lucrări": every signed job on one board by install step, and the crews' week with their
// visits (docs/features/phase3.md). The data comes from lib/jobActions.js loadJobs; the page is the view.
import "../dx.css";
import "./jobs.css";
import { loadJobs } from "../../../lib/jobActions.js";
import { appTitle } from "../../../lib/pageTitle.js";
import JobsView from "./JobsView.jsx";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("nav_jobs");

export default async function JobsPage(props) {
  const sp = await props.searchParams;
  const data = await loadJobs({ monday: sp?.week || null });
  const tab = sp?.view === "week" ? "week" : "board";
  return <JobsView data={data} tab={tab} />;
}
