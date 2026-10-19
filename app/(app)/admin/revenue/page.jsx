// app/(app)/admin/revenue/page.jsx — what VoltMira earns each month under the
// pay-per-signed-job model (lib/successFees.js): every installer's statement,
// the banks' commission, the total, a CSV for invoicing and a simulator.
// Platform admins only; anyone else gets a 404. A local preview: while the
// model is off (always, in a production build) it says how to turn it on.
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { normLang } from "../../../../lib/i18n.js";
import { ft } from "../../../../lib/feeText.js";
import { successFeesOn, periodOf } from "../../../../lib/successFees.js";
import { revenueMonth, lastMonths } from "../../../../lib/feeData.js";
import AdminNav, { ADMIN_CSS } from "../AdminNav.jsx";
import RevenueView from "../../../../components/fees/RevenueView.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue | VoltMira", robots: { index: false } };

export default async function RevenuePage(props) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  const head = (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="dx-head"><div className="dx-hello"><h1>{ft("rv_title", lang)}</h1><p className="dx-summary">{ft("rv_sub", lang)}</p></div></header>
      <AdminNav lang={lang} here="/admin/revenue" />
    </>
  );
  if (!successFeesOn()) return <div className="dx adm">{head}<div className="adm-warn">{ft("rv_off", lang)}</div></div>;

  const sp = await props.searchParams;
  const current = periodOf(new Date().toISOString());
  const wanted = String(sp?.month || "");
  const period = lastMonths(current).includes(wanted) ? wanted : current;
  const data = await revenueMonth(period);
  return (
    <div className="dx adm">
      {head}
      <RevenueView lang={lang} data={data} monthHref={(m) => `/admin/revenue?month=${m}`} csvHref={`/api/admin/revenue?month=${period}`} />
    </div>
  );
}
