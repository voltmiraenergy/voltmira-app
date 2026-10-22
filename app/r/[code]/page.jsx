// app/r/[code]/page.jsx — a friend's recommendation: the page a signed client
// sends (from their offer, ClientAfter.jsx). It names the installer, who
// recommends them (a first name and a locality, never an address), the
// recommending client's real system (size, battery, how long from signing to
// working, and what it has produced against the offer when it has readings),
// what happens after the friend leaves a number, and a short form: name,
// phone, locality, monthly bill. The form becomes a hot lead for the installer
// (app/api/referral). Only a signed offer has this page; never indexed.
import { notFound } from "next/navigation";
import { quote, SOLAR_SEASON } from "@voltmira/engine";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { normLang } from "../../../lib/i18n.js";
import { snapshotEngine } from "../../../lib/engineSettings.js";
import { bomHasBattery } from "../../../lib/quoteInput.js";
import { fmtDate } from "../../../lib/tz.js";
import { toIntlPhone } from "../../../lib/phone.js";
import { journeySteps, nextStep, productionSeries, journeyFacts, firstName, localityOf } from "../../../lib/clientJourney.js";
import { findByReferral } from "../../../lib/referral.js";
import { rt } from "./text.js";
import ReferralForm from "./ReferralForm.jsx";
import ProdBars from "../../p/[code]/ProdBars.jsx";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import "../../p/[code]/proposal.css";

export const dynamic = "force-dynamic";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const BILL_UNIT = { MDL: "lei", RON: "lei", UAH: "грн", EUR: "€" };

async function load(code) {
  const db = supabaseAdmin();
  // the link carries the referral token, not the offer's own code
  const prop = await findByReferral(db, code, "code, project_id, company_id, accepted_at, snapshot");
  if (!prop || !prop.accepted_at || !prop.snapshot) return null;
  const [{ data: co }, { data: pj }, { data: reads }] = await Promise.all([
    db.from("companies").select("name, short_name, logo_url, lang, engine, currency").eq("id", prop.company_id).maybeSingle(),
    db.from("projects").select("client_name, address, kw, install_progress, owner_id").eq("id", prop.project_id).maybeSingle(),
    db.from("production_readings").select("month, kwh").eq("project_id", prop.project_id).order("month", { ascending: false }).limit(12),
  ]);
  if (!co) return null;
  const snap = prop.snapshot;
  let prod0 = 0, year1 = 0;
  try {
    const q = quote({ ...snap, bomHasBattery: bomHasBattery(snap.bom) }, snapshotEngine(snap.engine, co));
    prod0 = Number(q.e.solar0) || Number(q.e.prod0) || 0;
    year1 = Number(q.e.year1) || 0;
  } catch { /* an old snapshot the engine cannot read: no forecast line */ }
  const shape = Array.isArray(snap.monthlyYieldShape) && snap.monthlyYieldShape.length === 12 ? snap.monthlyYieldShape : SOLAR_SEASON;
  const steps = journeySteps({ signedAt: prop.accepted_at, progress: pj?.install_progress });
  const production = productionSeries((reads || []).filter((r) => Number(r.kwh) > 0), prod0, shape);
  const facts = journeyFacts(steps, production, { year1, prod0 });
  let rep = null;
  if (pj?.owner_id) {
    const { data: pf } = await db.from("profiles").select("name, phone").eq("id", pj.owner_id).maybeSingle();
    if (pf?.name && pf?.phone) rep = { name: pf.name, phone: toIntlPhone(pf.phone, snap.market || "MD"), shown: String(pf.phone).trim() };
  }
  return {
    lang: normLang(co.lang),
    company: co.short_name || co.name || "",
    logo: /^https:\/\//.test(co.logo_url || "") ? co.logo_url : null,
    unit: BILL_UNIT[co.currency] || "lei",
    who: firstName(pj?.client_name || snap.client),
    where: localityOf(pj?.address || snap.address),
    kw: Number(pj?.kw || snap.kw) || 0,
    battKwh: snap.batt ? Number(snap.battKwh) || 0 : 0,
    live: !nextStep(steps),
    liveAt: steps.find((s) => s.id === "live")?.at || null,
    production, facts, rep: rep?.phone ? rep : null,
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
  const { lang, production: pr, facts } = d;
  const loc = LOC[lang] || "ro-RO";
  const nf = (n, digits = 0) => new Intl.NumberFormat(loc, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  const monthYear = (iso) => fmtDate(`${String(iso).slice(0, 7)}-15T12:00:00Z`, loc, { month: "long", year: "numeric" });
  const kw = nf(d.kw, d.kw % 1 ? 1 : 0);
  const rows = pr.rows || [];
  const hasProd = d.live && rows.length > 0;

  return (
    <main className="pp" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap rf">
        <header className="rf-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.logo ? <img className="rf-logo" src={d.logo} alt={d.company} /> : <b className="rf-name">{d.company}</b>}
          <small>{rt("eyebrow", lang)}</small>
        </header>

        <div className="rf-grid">
          <div className="rf-story">
            <h1 className="rf-h1">{d.who ? rt("h_who", lang, { who: d.who, co: d.company }) : rt("h", lang, { co: d.company })}</h1>
            <p className="rf-lead">
              {d.where ? rt("lead_where", lang, { kw, where: d.where, co: d.company }) : rt("lead", lang, { kw, co: d.company })}
              {hasProd ? " " + rt("produced", lang, { kwh: nf(pr.total), n: rows.length }) : ""}
            </p>
            {/* on a phone the form sits below the proof: one tap takes the friend there */}
            <a className="pp-btn pp-btn-accept rf-jump" href="#rf-form-h">{rt("send", lang)}</a>

            <section className="pp-card rf-proof" aria-labelledby="rf-proof-h">
              <h2 id="rf-proof-h">{d.who ? rt("proof_h_who", lang, { who: d.who }) : rt("proof_h", lang)}</h2>
              <dl className="rf-facts">
                <div><dt>{rt("k_kw", lang)}</dt><dd>{kw} <small>kW</small></dd></div>
                {d.battKwh > 0 && <div><dt>{rt("k_batt", lang)}</dt><dd>{nf(d.battKwh, d.battKwh % 1 ? 1 : 0)} <small>kWh</small></dd></div>}
                {d.where && <div><dt>{rt("k_where", lang)}</dt><dd>{d.where}</dd></div>}
                {d.liveAt && <div><dt>{rt("k_since", lang)}</dt><dd>{monthYear(d.liveAt)}</dd></div>}
                {facts.days != null && <div><dt>{rt("k_days", lang)}</dt><dd>{rt("k_days_v", lang, { d: facts.days })}</dd></div>}
                {hasProd && <div><dt>{rt("k_prod", lang, { n: rows.length })}</dt><dd>{nf(pr.total)} <small>kWh</small></dd></div>}
                {hasProd && pr.pct != null && <div className={pr.pct >= 100 ? "up" : ""}><dt>{rt("k_pct", lang)}</dt><dd>{nf(pr.pct)}%</dd></div>}
                {!d.live && <div><dt>{rt("k_state", lang)}</dt><dd>{rt("k_state_v", lang)}</dd></div>}
              </dl>
              {hasProd && rows.length >= 3 && <ProdBars rows={rows} lang={lang} nf={nf} best={facts.best} compact />}
            </section>

            <section className="rf-next" aria-labelledby="rf-next-h">
              <h2 id="rf-next-h">{rt("next_h", lang)}</h2>
              <ol>
                <li>{rt("next_1", lang, { co: d.company })}</li>
                <li>{rt("next_2", lang)}</li>
                <li>{rt("next_3", lang)}</li>
              </ol>
            </section>
          </div>

          <aside className="rf-side">
            <section className="pp-card rf-card" aria-labelledby="rf-form-h">
              <h2 id="rf-form-h">{rt("form_h", lang)}</h2>
              <p>{rt("form_p", lang, { co: d.company })}</p>
              <ReferralForm code={code} lang={lang} unit={d.unit} />
              <p className="rf-fine">{rt("fine", lang, { co: d.company })}</p>
              {d.rep && (
                <p className="rf-direct">
                  <span>{rt("direct", lang, { name: d.rep.name })}</span>
                  <a href={`tel:+${d.rep.phone}`}>{d.rep.shown}</a>
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
