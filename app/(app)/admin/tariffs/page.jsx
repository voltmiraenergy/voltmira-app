// app/(app)/admin/tariffs/page.jsx — the versioned tariff rules, and
// publishing a new version without a deploy (docs/TARIFFS_AND_SUBSIDIES.md).
// Platform admins only (PLATFORM_ADMIN_EMAILS); anyone else gets a 404.
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { loadTariffRules, forgetTariffCache } from "../../../../lib/tariffStore.js";
import { normLang } from "../../../../lib/i18n.js";
import { at } from "../../../../lib/adminText.js";
import AdminNav, { ADMIN_CSS } from "../AdminNav.jsx";
import TariffAdmin from "./TariffAdmin.jsx";

export const dynamic = "force-dynamic";

export default async function TariffsPage() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  forgetTariffCache();   // the admin sees what is published this second
  const { rows, needsDb } = await loadTariffRules();
  return (
    <div className="dx adm">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="dx-head"><div className="dx-hello"><h1>{at("ad_tariffs", lang)}</h1><p className="dx-summary">{at("tr_sub", lang)}</p></div></header>
      <AdminNav lang={lang} here="/admin/tariffs" />
      {needsDb && <p className="adm-warn" role="note">{at("ad_needs_db", lang)}</p>}
      <TariffAdmin rules={rows} lang={lang} canPublish={!needsDb} today={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
