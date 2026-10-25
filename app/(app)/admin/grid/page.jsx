// app/(app)/admin/grid/page.jsx — what each grid operator asks for with a connection file, and how long a file
// usually waits in each step; a change is published as a new version without a deploy (lib/gridRules.js,
// docs/features/phase2.md). Platform admins only (PLATFORM_ADMIN_EMAILS); anyone else gets a 404.
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { loadGridRules, forgetGridRulesCache } from "../../../../lib/gridRulesStore.js";
import { latestGridRules, GRID_OPERATORS } from "../../../../lib/gridRules.js";
import { normLang } from "../../../../lib/i18n.js";
import { at } from "../../../../lib/adminText.js";
import { gt } from "../../../../lib/gridText.js";
import AdminNav, { ADMIN_CSS } from "../AdminNav.jsx";
import GridRulesAdmin from "./GridRulesAdmin.jsx";

export const dynamic = "force-dynamic";

export default async function GridRulesPage() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  forgetGridRulesCache();   // the admin sees what is published this second
  const { rows, needsDb, fromDb } = await loadGridRules();
  const current = Object.fromEntries(GRID_OPERATORS.map((op) => [op, latestGridRules(rows, op)]));
  const history = fromDb ? rows.map((r) => ({ operator: r.operator, version: r.version, note: r.note || "", by: r.created_by || "", at: r.created_at || "" })).reverse() : [];
  return (
    <div className="dx adm">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="dx-head"><div className="dx-hello"><h1>{at("ad_grid", lang)}</h1><p className="dx-summary">{gt("gr_sub", lang)}</p></div></header>
      <AdminNav lang={lang} here="/admin/grid" />
      {needsDb && <p className="adm-warn" role="note">{gt("gr_needs_db", lang)}</p>}
      <GridRulesAdmin current={current} history={history} lang={lang} canPublish={!needsDb} />
    </div>
  );
}
