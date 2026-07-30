// app/widget/page.jsx — PUBLIC embeddable lead form: /widget?c=COMPANY_ID
// Server component: it looks the installer's language up from their company row
// so the homeowner reads the form in the right language without the embed
// snippet having to pass anything. ?lang=ro still overrides for previews.
import { supabaseAdmin } from "../../lib/supabase.js";
import { normLang, LANGS } from "../../lib/i18n.js";
import WidgetForm from "./WidgetForm.jsx";

export const dynamic = "force-dynamic";

async function companyLang(companyId) {
  if (!companyId) return "en";
  try {
    const { data } = await supabaseAdmin()
      .from("companies").select("lang").eq("id", companyId).single();
    return normLang(data?.lang);
  } catch {
    return "en"; // a lookup failure must never break the form
  }
}

export default async function WidgetPage({ searchParams }) {
  const companyId = String(searchParams?.c || "");
  const override = String(searchParams?.lang || "");
  const lang = LANGS.includes(override) ? override : await companyLang(companyId);

  return (
    <main lang={lang} style={{ maxWidth: 380, margin: "0 auto", padding: 18,
      fontFamily: "Inter, system-ui, sans-serif", color: "#142A21" }}>
      <WidgetForm companyId={companyId} lang={lang} />
    </main>
  );
}
