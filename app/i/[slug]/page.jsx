// app/i/[slug]/page.jsx — an installer's public profile (docs/MARKETPLACE.md):
// shown only while published and verified with documents in date. Every
// claim on it comes from records, not from the installer's own words: the
// systems commissioned through VoltMira, what monitored systems measured
// against their offers (only with enough data), and ratings left by owners of
// commissioned systems. The about text is the installer's, and says so by
// being plain text under their name.
import { notFound } from "next/navigation";
import { quote } from "@voltmira/engine";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { normLang } from "../../../lib/i18n.js";
import { ht } from "../../../lib/homeText.js";
import { raionName } from "../../../lib/mdRaions.js";
import { verificationState, ratingSummary, performanceClaim } from "../../../lib/marketplace.js";
import { productionSeries } from "../../../lib/clientJourney.js";
import { snapshotEngine } from "../../../lib/engineSettings.js";
import { offerQuoteInput } from "../../../lib/offerInput.js";
import { fmtDate } from "../../../lib/tz.js";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import Logo from "../../../lib/Logo.jsx";
import "../../p/[code]/proposal.css";
import "../../solar/funnel.css";
import "./profile.css";

export const dynamic = "force-dynamic";
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const SOLAR = { en: "/solar", ro: "/ro/solar", ru: "/ru/solar", uk: "/uk/solar" };

async function load(slug) {
  if (!/^[a-z0-9-]{3,60}$/.test(String(slug || ""))) return null;
  const db = supabaseAdmin();
  const { data: p } = await db.from("installer_profiles").select("*").eq("slug", slug).maybeSingle();
  if (!p?.published || verificationState(p).state !== "verified") return null;
  const [{ data: co }, { data: reviews }, { data: won }] = await Promise.all([
    db.from("companies").select("id, name, short_name, legal_name, logo_url, lang, engine").eq("id", p.company_id).maybeSingle(),
    db.from("reviews").select("rating, body, author, hidden, created_at").eq("company_id", p.company_id).eq("hidden", false).order("created_at", { ascending: false }).limit(20),
    db.from("projects").select("id, install_progress").eq("company_id", p.company_id).eq("status", "won").limit(1000),
  ]);
  if (!co) return null;
  const commissioned = (won || []).filter((x) => x.install_progress?.commission).map((x) => x.id);
  // measured production against the offers, for the commissioned systems with readings
  let perf = null;
  if (commissioned.length) {
    const ids = commissioned.slice(0, 60);
    const [{ data: reads }, { data: props }] = await Promise.all([
      db.from("production_readings").select("project_id, month, kwh").in("project_id", ids),
      db.from("proposals").select("project_id, snapshot").in("project_id", ids).not("accepted_at", "is", null),
    ]);
    const systems = [];
    for (const id of ids) {
      const r = (reads || []).filter((x) => x.project_id === id);
      const snap = (props || []).find((x) => x.project_id === id)?.snapshot;
      if (!r.length || !snap) continue;
      let prod0 = 0;
      try { prod0 = quote(offerQuoteInput(snap), snapshotEngine(snap.engine, co)).e.prod0; } catch { continue; }
      const s = productionSeries(r, prod0, snap.monthlyYieldShape, 12);
      systems.push({ total: s.total, expectedTotal: s.expectedTotal, months: s.rows.length });
    }
    perf = performanceClaim(systems);
  }
  return { p, co, reviews: reviews || [], installs: commissioned.length, perf };
}

export async function generateMetadata(props) {
  const { slug } = await props.params;
  const d = await load(slug);
  if (!d) return { title: "VoltMira", robots: { index: false } };
  const name = d.co.short_name || d.co.name;
  return { title: `${name} | VoltMira`, description: d.p.about?.slice(0, 160) || name, alternates: { canonical: `https://voltmira.com/i/${slug}` } };
}

export default async function InstallerProfile(props) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const d = await load(slug);
  if (!d) notFound();
  const { p, co, reviews, installs, perf } = d;
  const lang = normLang(sp?.lang || co.lang || "ro");
  const loc = LOC[lang];
  const v = verificationState(p);
  const rating = ratingSummary(reviews);
  const regions = (p.regions || []).includes("all") ? ht("ip_all", lang) : (p.regions || []).map((r) => raionName(r, lang)).join(", ");
  const nf = (n, dg = 0) => Number(n).toLocaleString(loc, { maximumFractionDigits: dg });

  return (
    <main className="pp sf" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap sf-wrap">
        <header className="sf-top"><a href={lang === "en" ? "/" : `/${lang}`} aria-label="VoltMira"><Logo size={30} /></a></header>
        <section className="ip-head">
          {/^https:\/\//.test(co.logo_url || "") && <img className="ip-logo" src={co.logo_url} alt="" />}
          <div>
            <h1 className="sf-h1">{co.short_name || co.name}</h1>
            <p className="ip-badge">{ht("ip_verified", lang)}</p>
            <p className="sf-p">{ht("ip_verified_p", lang, { d: fmtDate(`${v.expiresOn}T12:00:00Z`, loc, { day: "numeric", month: "long", year: "numeric" }) })}</p>
          </div>
        </section>
        {p.about && <p className="sf-p ip-about">{p.about}</p>}

        <dl className="ip-facts">
          <div><dt>{ht("ip_regions", lang)}</dt><dd>{regions}</dd><dd className="s">{ht("ip_size", lang, { a: nf(p.min_kw, 1), b: nf(p.max_kw, 1) })}</dd></div>
          <div><dt>{ht("ip_installs", lang)}</dt><dd>{ht("ip_installs_n", lang, { n: installs })}</dd></div>
          <div><dt>{ht("ip_perf", lang)}</dt>{perf ? <><dd>{ht("ip_perf_v", lang, { pct: perf.pct })}</dd><dd className="s">{ht("ip_perf_s", lang, { s: perf.systems, m: perf.months })}</dd></> : <dd className="s">{ht("ip_perf_none", lang)}</dd>}</div>
          <div><dt>{ht("ip_rating", lang)}</dt>{rating.count ? <dd>{ht("ip_rating_v", lang, { a: nf(rating.average, 1), n: rating.count })}</dd> : <dd className="s">{ht("ip_rating_none", lang)}</dd>}</div>
        </dl>

        {reviews.length > 0 && (
          <ul className="ip-reviews">
            {reviews.map((r, i) => <li key={i}><b>{r.rating}/5</b>{r.body && <p>{r.body}</p>}<small>{r.author}</small></li>)}
          </ul>
        )}

        <a className="pp-btn pp-btn-accept ip-cta" href={SOLAR[lang]}>{ht("ip_ask", lang)}</a>
      </div>
    </main>
  );
}
