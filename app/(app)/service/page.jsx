// app/(app)/service/page.jsx — "Service": every installed system after the handover (docs/features/phase5.md): its
// production against its offer and its inverter portal, the clients' requests, the yearly checks and the warranties.
// The data comes from lib/serviceActions.js loadService; the page is the view.
import "../dx.css";
import "./service.css";
import { loadService } from "../../../lib/serviceActions.js";
import { appTitle } from "../../../lib/pageTitle.js";
import ServiceView from "./ServiceView.jsx";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("nav_service");

const TABS = ["systems", "requests", "checks", "warranty"];

export default async function ServicePage(props) {
  const sp = await props.searchParams;
  const data = await loadService();
  const tab = TABS.includes(sp?.tab) ? sp.tab : "systems";
  return <ServiceView data={data} tab={tab} openId={typeof sp?.r === "string" ? sp.r : null} />;
}
