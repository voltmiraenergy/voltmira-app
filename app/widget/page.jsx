// app/widget/page.jsx — PUBLIC embeddable lead form: /widget?c=COMPANY_ID
// Server component: it looks the installer's language up from their company row
// so the homeowner reads the form in the right language without the embed
// snippet having to pass anything. ?lang=ro still overrides for previews.
import { supabaseAdmin } from "../../lib/supabase.js";
import { normLang, LANGS } from "../../lib/i18n.js";
import WidgetForm from "./WidgetForm.jsx";

export const dynamic = "force-dynamic";

async function companyInfo(companyId) {
  if (!companyId) return { lang: "en", market: "MD" };
  try {
    const { data } = await supabaseAdmin()
      .from("companies").select("lang, default_market").eq("id", companyId).single();
    return { lang: normLang(data?.lang), market: data?.default_market || "MD" };
  } catch {
    return { lang: "en", market: "MD" }; // a lookup failure must never break the form
  }
}

export default async function WidgetPage({ searchParams }) {
  const companyId = String(searchParams?.c || "");
  const override = String(searchParams?.lang || "");
  const co = await companyInfo(companyId);
  const lang = LANGS.includes(override) ? override : co.lang;

  return (
    // Explicit light background+color scheme: this renders in an <iframe> on
    // an arbitrary installer's own site, so it must look right on its own,
    // not follow whatever dark-mode default the visitor's OS/browser or this
    // app's own root layout would otherwise leak in — every color the form
    // itself uses (WidgetForm.jsx) assumes a light background.
    <main lang={lang} style={{ maxWidth: 380, margin: "0 auto", padding: 18, minHeight: "100vh",
      fontFamily: "Inter, system-ui, sans-serif", color: "#142A21", background: "#fff", colorScheme: "light" }}>
      <WidgetForm companyId={companyId} lang={lang} market={co.market} />
    </main>
  );
}
