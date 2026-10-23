// app/(app)/documents/export/page.jsx — the 1C export (docs/INTEGRATIONS.md):
// a date range, the format, and the workspace's saved column mapping.
// Downloads from /api/export-1c.
import { supabaseServer } from "../../../../lib/supabase.js";
import { currentCompany } from "../../../../lib/session.js";
import { t, normLang } from "../../../../lib/i18n.js";
import { xt } from "../../../../lib/integrationText.js";
import { mdDayKey } from "../../../../lib/tz.js";
import { cleanMapping, FIELDS, DEFAULT_MAPPING } from "../../../../lib/export1c.js";
import BackLink from "../../../../components/BackLink.jsx";
import ExportForm from "./ExportForm.jsx";
import "../../dx.css";
import "../../projects/[id]/billing/billing.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "1C | VoltMira" };

export default async function ExportPage() {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const sb = await supabaseServer();
  const { data, error } = await sb.from("export_mappings").select("mapping").maybeSingle();
  const needsDb = !!error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || ""));
  // last month by the Chișinău calendar, not the server's
  const [ty, tm] = mdDayKey(new Date()).split("-").map(Number);
  const first = new Date(Date.UTC(ty, tm - 2, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(ty, tm - 1, 0)).toISOString().slice(0, 10);

  return (
    <div className="dx bl">
      <BackLink href="/documents">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
        {t("nav_documents", lang)}
      </BackLink>
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{xt("ex_title", lang)}</h1>
          <p className="dx-summary">{xt("ex_sub", lang)}</p>
        </div>
      </header>
      {needsDb && <p className="bl-note bad" role="status">{xt("bl_needs_db", lang)}</p>}
      <ExportForm lang={lang} initial={cleanMapping(data?.mapping || {})} defaults={DEFAULT_MAPPING} fields={FIELDS} from={first} to={last} needsDb={needsDb} />
    </div>
  );
}
