// app/r/[code]/page.jsx — a friend's recommendation: the page a signed client
// sends (from their offer, ClientAfter.jsx). It names the installer, who
// recommends them (a first name and a locality, never an address), what that
// client's system has really produced when it has readings, and a short form:
// name, phone, locality. The form becomes a hot lead for the installer
// (app/api/referral). Only a signed offer has this page; never indexed.
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { normLang } from "../../../lib/i18n.js";
import { firstName, localityOf } from "../../../lib/clientJourney.js";
import { rt } from "./text.js";
import ReferralForm from "./ReferralForm.jsx";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import "../../p/[code]/proposal.css";

export const dynamic = "force-dynamic";

async function load(code) {
  if (!/^[a-z0-9]{6,16}$/i.test(String(code || ""))) return null;
  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals").select("code, project_id, company_id, accepted_at, snapshot").eq("code", code).maybeSingle();
  if (!prop || !prop.accepted_at) return null;
  const [{ data: co }, { data: pj }, { data: reads }] = await Promise.all([
    db.from("companies").select("name, short_name, logo_url, lang").eq("id", prop.company_id).maybeSingle(),
    db.from("projects").select("client_name, address, kw, install_progress").eq("id", prop.project_id).maybeSingle(),
    db.from("production_readings").select("month, kwh").eq("project_id", prop.project_id).order("month", { ascending: false }).limit(12),
  ]);
  if (!co) return null;
  const rows = (reads || []).filter((r) => Number(r.kwh) > 0);
  return {
    lang: normLang(co.lang),
    company: co.short_name || co.name || "",
    logo: /^https:\/\//.test(co.logo_url || "") ? co.logo_url : null,
    who: firstName(pj?.client_name || prop.snapshot?.client),
    where: localityOf(pj?.address || prop.snapshot?.address),
    kw: Number(pj?.kw || prop.snapshot?.kw) || 0,
    live: !!pj?.install_progress?.commission,
    produced: rows.reduce((s, r) => s + Number(r.kwh), 0),
    months: rows.length,
  };
}

export async function generateMetadata(props) {
  const { code } = await props.params;
  const d = await load(code).catch(() => null);
  return { title: d ? rt("title", d.lang, { co: d.company }) : "VoltMira", robots: { index: false, follow: false, nocache: true } };
}

export default async function ReferralPage(props) {
  const { code } = await props.params;
  const d = await load(code);
  if (!d) notFound();
  const { lang } = d;
  const nf = (n) => new Intl.NumberFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { maximumFractionDigits: 0 }).format(n);
  return (
    <main className="pp" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap rf">
        <header className="rf-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.logo ? <img className="rf-logo" src={d.logo} alt={d.company} /> : <b className="rf-name">{d.company}</b>}
        </header>
        <h1 className="pp-h2">{d.who ? rt("h_who", lang, { who: d.who, co: d.company }) : rt("h", lang, { co: d.company })}</h1>
        <p className="pp-lead">
          {d.where ? rt("lead_where", lang, { kw: d.kw.toFixed(1), where: d.where, co: d.company }) : rt("lead", lang, { kw: d.kw.toFixed(1), co: d.company })}
          {d.live && d.months > 0 ? " " + rt("produced", lang, { kwh: nf(d.produced), n: d.months }) : ""}
        </p>
        <section className="pp-card rf-card">
          <h2>{rt("form_h", lang)}</h2>
          <p>{rt("form_p", lang, { co: d.company })}</p>
          <ReferralForm code={code} lang={lang} />
        </section>
        <p className="rf-fine">{rt("fine", lang, { co: d.company })}</p>
      </div>
    </main>
  );
}
