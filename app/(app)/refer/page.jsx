// app/(app)/refer/page.jsx — the referral program. Each installer gets a unique
// link; installers they bring in are tracked here. RLS + service-role scoped.
import { currentCompany } from "../../../lib/session.js";
import { getOrCreateReferralCode, listReferrals } from "../../../lib/actions.js";
import { normLang } from "../../../lib/i18n.js";
import ReferClient from "./ReferClient.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Refer & earn — VoltMira" };

export default async function ReferPage() {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const code = await getOrCreateReferralCode();
  const referrals = await listReferrals();
  const link = `https://voltmira.com/login?ref=${code}`;
  return (
    <ReferClient link={link} code={code} referrals={referrals} lang={lang}
      companyName={co?.name || "VoltMira"} />
  );
}
