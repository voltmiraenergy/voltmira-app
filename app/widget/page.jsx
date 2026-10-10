// app/widget/page.jsx — PUBLIC embeddable lead form: /widget?c=COMPANY_ID
// Server component: it looks the installer's language up from their company row
// so the homeowner reads the form in the right language without the embed
// snippet having to pass anything. ?lang=ro still overrides for previews.
import { cache } from "react";
import { supabaseAdmin } from "../../lib/supabase.js";
import { normLang, LANGS, t } from "../../lib/i18n.js";
import WidgetForm from "./WidgetForm.jsx";
import HtmlLang from "../../lib/HtmlLang.jsx";

export const dynamic = "force-dynamic";

// cache(): the page and its <title> both need the company row, read once.
const companyInfo = cache(async (companyId) => {
  if (!companyId) return { lang: "en", market: "MD" };
  try {
    const { data } = await supabaseAdmin()
      .from("companies").select("lang, default_market").eq("id", companyId).single();
    return { lang: normLang(data?.lang), market: data?.default_market || "MD" };
  } catch {
    return { lang: "en", market: "MD" }; // a lookup failure must never break the form
  }
});

async function widgetLang(props) {
  const searchParams = await props.searchParams;
  const companyId = String(searchParams?.c || "");
  const override = String(searchParams?.lang || "");
  const co = await companyInfo(companyId);
  return { companyId, co, lang: LANGS.includes(override) ? override : co.lang };
}

// The tab title a homeowner sees if the widget is opened on its own, in their
// language, instead of VoltMira's English marketing title.
export async function generateMetadata(props) {
  const { lang } = await widgetLang(props);
  return { title: t("wg_title", lang) };
}

export default async function WidgetPage(props) {
  const { companyId, co, lang } = await widgetLang(props);

  return (
    // Explicit light background+color scheme: this renders in an <iframe> on
    // an arbitrary installer's own site, so it must look right on its own,
    // not follow whatever dark-mode default the visitor's OS/browser or this
    // app's own root layout would otherwise leak in — every color the form
    // itself uses (WidgetForm.jsx) assumes a light background.
    <main lang={lang} style={{ maxWidth: 380, margin: "0 auto", padding: 18, minHeight: "100vh",
      fontFamily: "Inter, system-ui, sans-serif", color: "#142A21", background: "#fff", colorScheme: "light" }}>
      {/* The page around the 380px column too: in a wide iframe a dark-OS
          visitor otherwise saw dark bands either side of the white form. */}
      <style>{"html,body{background:#fff !important}"}</style>
      <HtmlLang lang={lang} />
      <WidgetForm companyId={companyId} lang={lang} market={co.market} />
    </main>
  );
}
