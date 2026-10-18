// app/solar/status/[token]/page.jsx — a homeowner follows their request
// (docs/MARKETPLACE.md): who accepted it, with a link to each installer's
// profile, and how many are still deciding. The token is the capability; only
// its hash is stored. Never indexed.
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { hashToken, sweepOffers } from "../../../../lib/marketFlow.js";
import { marketIo } from "../../../../lib/marketServer.js";
import { ht } from "../../../../lib/homeText.js";
import { fmtDate } from "../../../../lib/tz.js";
import HtmlLang from "../../../../lib/HtmlLang.jsx";
import Logo from "../../../../lib/Logo.jsx";
import "../../../p/[code]/proposal.css";
import "../../funnel.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "VoltMira", robots: { index: false, follow: false, nocache: true } };

export default async function RequestStatus(props) {
  const { token } = await props.params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(String(token || ""))) notFound();
  const db = supabaseAdmin();
  await sweepOffers(db, { io: marketIo(db) }).catch(() => null);
  const { data: r } = await db.from("quote_requests").select("id, lang, address, kw, status, created_at").eq("status_token_hash", hashToken(token)).maybeSingle();
  if (!r) notFound();
  const lang = r.lang || "ro";
  const { data: offers } = await db.from("lead_offers").select("company_id, status").eq("request_id", r.id);
  const accepted = (offers || []).filter((o) => o.status === "accepted").map((o) => o.company_id);
  const waiting = (offers || []).filter((o) => o.status === "offered").length;
  const [{ data: cos }, { data: profs }] = accepted.length
    ? await Promise.all([db.from("companies").select("id, name, short_name").in("id", accepted), db.from("installer_profiles").select("company_id, slug").in("company_id", accepted)])
    : [{ data: [] }, { data: [] }];
  const slug = new Map((profs || []).map((p) => [p.company_id, p.slug]));
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang];

  return (
    <main className="pp sf" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap sf-wrap">
        <header className="sf-top"><Logo size={30} /></header>
        <section className="pp-card sf-card">
          <h1 className="pp-h2">{ht("rs_title", lang)}</h1>
          <p className="sf-p">{ht("rs_sub", lang, { kw: Number(r.kw).toLocaleString(loc), address: r.address, d: fmtDate(r.created_at, loc, { day: "numeric", month: "long" }) })}</p>
          {accepted.length > 0 && (
            <>
              <p className="sf-p"><b>{ht("rs_accepted", lang)}</b></p>
              <ul className="sf-acc">
                {(cos || []).map((c) => (
                  <li key={c.id}><b>{c.short_name || c.name}</b>{slug.get(c.id) && <a href={`/i/${slug.get(c.id)}`}>{ht("rs_profile", lang)}</a>}</li>
                ))}
              </ul>
            </>
          )}
          {waiting > 0 && <p className="sf-p">{accepted.length ? ht("rs_waiting", lang, { n: waiting }) : ht("rs_open", lang)}</p>}
          {r.status === "unmatched" && <p className="sf-p">{ht("rs_unmatched", lang)}</p>}
        </section>
      </div>
    </main>
  );
}
