// app/(app)/admin/subsidies/page.jsx — the versioned support programmes, and
// publishing a new version or programme without a deploy
// (docs/TARIFFS_AND_SUBSIDIES.md). Platform admins only; anyone else gets a 404.
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { loadSubsidyPrograms, forgetTariffCache } from "../../../../lib/tariffStore.js";
import { normLang } from "../../../../lib/i18n.js";
import { at } from "../../../../lib/adminText.js";
import AdminNav, { ADMIN_CSS } from "../AdminNav.jsx";
import SubsidyAdmin from "./SubsidyAdmin.jsx";

export const dynamic = "force-dynamic";

export default async function SubsidiesPage() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  forgetTariffCache();
  const { rows, needsDb } = await loadSubsidyPrograms();
  return (
    <div className="dx adm">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="dx-head"><div className="dx-hello"><h1>{at("ad_programs", lang)}</h1><p className="dx-summary">{at("sb_sub", lang)}</p></div></header>
      <AdminNav lang={lang} here="/admin/subsidies" />
      {needsDb && <p className="adm-warn" role="note">{at("ad_needs_db", lang)}</p>}
      <SubsidyAdmin programs={rows} lang={lang} canPublish={!needsDb} />
    </div>
  );
}
