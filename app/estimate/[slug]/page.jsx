// app/estimate/[slug]/page.jsx — an installer's public estimate page: VoltMira's free estimate in the installer's
// own colours and logo, at their own address (companies.public_slug), for their website, Facebook page or a link.
// Off unless ESTIMATE_PAGE=on (lib/offerSwitches.js), and only for a workspace that chose an address in Settings.
// ?embed=1 drops the page header for an <iframe>; ?lang= picks the language, else the browser's, else the
// installer's (lib/publicPage.js). Kept out of search results: the installer's own site is the page to find.
import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { normLang } from "../../../lib/i18n.js";
import { estimatePageOn } from "../../../lib/offerSwitches.js";
import { pageLang, cleanColor, textOn } from "../../../lib/publicPage.js";
import { et } from "../../../lib/estimateText.js";
import { companyForPage } from "../../../lib/estimateCompany.js";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import EstimateForm from "./EstimateForm.jsx";

export const dynamic = "force-dynamic";

// the page's own address, or the workspace id (which also works before add-quote-fast.sql has run)
const companyBySlug = cache((slug) => companyForPage(supabaseAdmin(), slug));

async function langFor(props, co) {
  const sp = await props.searchParams;
  const h = await headers();
  return pageLang({ asked: sp?.lang, acceptLanguage: h.get("accept-language"), fallback: normLang(co?.lang) });
}

export async function generateMetadata(props) {
  const { slug } = await props.params;
  const co = estimatePageOn() ? await companyBySlug(slug) : null;
  if (!co) return { robots: { index: false, follow: false } };
  const lang = await langFor(props, co);
  return { title: `${et("title", lang)} | ${co.short_name || co.name}`, robots: { index: false, follow: false } };
}

export default async function EstimatePage(props) {
  if (!estimatePageOn()) notFound();
  const { slug } = await props.params;
  const co = await companyBySlug(slug);
  if (!co) notFound();
  const sp = await props.searchParams;
  const lang = await langFor(props, co);
  const color = cleanColor(co.brand_color) || "#1e6b4e";
  const logo = /^(https:|data:image\/)/.test(String(co.logo_url || "")) ? co.logo_url : "";
  const embed = sp?.embed === "1";

  return (
    // light on purpose: the page sits in an <iframe> on an installer's own site, or opens from a Facebook post
    <main lang={lang} style={{ minHeight: "100vh", background: embed ? "#fff" : "#F6F5F0", colorScheme: "light",
      fontFamily: "Inter, system-ui, sans-serif", color: "#142A21", padding: embed ? "14px 16px" : "28px 16px 40px" }}>
      <style>{"html,body{background:" + (embed ? "#fff" : "#F6F5F0") + " !important}"}</style>
      <HtmlLang lang={lang} />
      <EstimateForm slug={String(slug).toLowerCase()} lang={lang} market={co.default_market || "MD"}
        company={{ name: co.short_name || co.name, logo }} color={color} onColor={textOn(color)} embed={embed} />
    </main>
  );
}
