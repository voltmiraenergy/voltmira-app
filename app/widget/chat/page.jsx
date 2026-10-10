// app/widget/chat/page.jsx — PUBLIC embeddable lead-assistant chat:
// /widget/chat?c=COMPANY_ID. The conversational sibling of /widget (the form):
// same embedding, same language lookup, leads land in the same list.
import { supabaseAdmin } from "../../../lib/supabase.js";
import { normLang, LANGS } from "../../../lib/i18n.js";
import ChatBox from "./ChatBox.jsx";
import HtmlLang from "../../../lib/HtmlLang.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat", robots: { index: false } };

async function companyInfo(companyId) {
  if (!companyId) return { lang: "en", name: "" };
  try {
    const { data } = await supabaseAdmin().from("companies").select("lang, name, short_name").eq("id", companyId).single();
    return { lang: normLang(data?.lang), name: data?.short_name || data?.name || "" };
  } catch {
    return { lang: "en", name: "" };   // a lookup failure must never break the chat
  }
}

export default async function WidgetChatPage(props) {
  const searchParams = await props.searchParams;
  const companyId = String(searchParams?.c || "");
  const override = String(searchParams?.lang || "");
  const co = await companyInfo(companyId);
  const lang = LANGS.includes(override) ? override : co.lang;
  return (
    // Explicit light scheme: this renders in an <iframe> on the installer's own
    // site and must look right there, whatever the visitor's OS theme is.
    <main lang={lang} style={{ maxWidth: 420, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif", color: "#142A21", background: "#fff", colorScheme: "light" }}>
      {/* the page around the 420px column too, or a dark-OS visitor sees dark
          bands either side of the chat in a wide iframe */}
      <style>{"html,body{background:#fff !important}"}</style>
      <HtmlLang lang={lang} />
      <ChatBox companyId={companyId} lang={lang} companyName={co.name} />
    </main>
  );
}
