// app/(app)/marketplace/page.jsx — the installer's side of the marketplace
// (docs/MARKETPLACE.md): requests offered to them with the time left to
// answer, the ones they took (with the contact, now theirs as a lead), their
// public profile and its verification, and the ratings owners left.
// A request's contact is read with the service role only once accepted.
import { supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { normLang } from "../../../lib/i18n.js";
import { xt, XT } from "../../../lib/integrationText.js";
import { COVERED, raionName } from "../../../lib/mdRaions.js";
import { loadProfile } from "../../../lib/profileFlow.js";
import { verificationState, verificationMissing, ratingSummary } from "../../../lib/marketplace.js";
import { sweepOffers } from "../../../lib/marketFlow.js";
import { marketIo } from "../../../lib/marketServer.js";
import OfferList from "./OfferList.jsx";
import ProfileForm from "./ProfileForm.jsx";
import "../dx.css";
import "../projects/[id]/billing/billing.css";
import "./marketplace.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketplace | VoltMira" };

export default async function MarketplacePage() {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const db = supabaseAdmin();
  await sweepOffers(db, { io: marketIo(db) }).catch(() => null);
  const { needsDb, profile } = await loadProfile(db, co.id);
  const [{ data: offers }, { data: reviews }] = await Promise.all([
    db.from("lead_offers").select("id, request_id, status, offered_at, respond_by, responded_at, lead_id").eq("company_id", co.id).order("offered_at", { ascending: false }).limit(60),
    db.from("reviews").select("rating, body, author, hidden, created_at").eq("company_id", co.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const ids = [...new Set((offers || []).map((o) => o.request_id))];
  const { data: reqs } = ids.length ? await db.from("quote_requests").select("id, raion, kw, cons_kwh_year, estimate, name, phone, email, address, created_at").in("id", ids) : { data: [] };
  const byId = new Map((reqs || []).map((r) => [r.id, r]));
  // only an accepted request carries its contact to the browser
  const rows = (offers || []).map((o) => {
    const r = byId.get(o.request_id) || {};
    const base = { id: o.id, status: o.status, respondBy: o.respond_by, offeredAt: o.offered_at, leadId: o.lead_id, where: raionName(r.raion, lang) || r.raion || "", kw: Number(r.kw) || 0, cons: r.cons_kwh_year || 0, cost: r.estimate?.cost?.local || null, payback: r.estimate?.payback?.expc ?? null };
    return o.status === "accepted" ? { ...base, contact: { name: r.name, phone: r.phone, email: r.email, address: r.address } } : base;
  });
  const v = verificationState(profile);
  const summary = ratingSummary(reviews || []);
  const T = Object.fromEntries(Object.keys(XT).filter((k) => k.startsWith("mp_") || k === "mk_needs_db").map((k) => [k, xt(k, lang)]));
  const raions = COVERED.map((r) => ({ id: r.id, name: raionName(r.id, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang));

  return (
    <div className="dx bl mp">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{xt("mp_title", lang)}</h1>
          <p className="dx-summary">{xt("mp_sub", lang)}</p>
        </div>
      </header>
      {needsDb && <p className="bl-note bad" role="status">{xt("mk_needs_db", lang)}</p>}

      <OfferList lang={lang} T={T} rows={rows} />

      <ProfileForm lang={lang} T={T} raions={raions} needsDb={needsDb}
        profile={profile ? { ...profile, licence_doc: !!profile.licence_doc, insurance_doc: !!profile.insurance_doc } : null}
        state={v} missing={verificationMissing(profile || {})} />

      <section className="dx-card bl-card" aria-labelledby="mp-rev-h">
        <header className="dx-card-head"><div><h2 id="mp-rev-h">{xt("mp_rev_h", lang)}</h2>
          {summary.count > 0 && <p>{xt("mp_rev_avg", lang, { a: summary.average, n: summary.count })}</p>}</div></header>
        {summary.count === 0 ? <p className="bl-muted">{xt("mp_rev_none", lang)}</p> : (
          <ul className="mp-revs">
            {(reviews || []).filter((r) => !r.hidden).map((r, i) => (
              <li key={i}><b>{r.rating}/5</b><span>{r.body || ""}</span><small>{r.author}</small></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
