// app/s/[token]/page.jsx — the client's "report a problem" page for their solar system (docs/features/phase5.md):
// what happened, a short description, a phone, up to 4 photos; the installer gets it as a request in Service. Public,
// reached only by the system's unguessable link (projects.service_token), never indexed. In the client's language
// (projects.client_lang), else the installer's; formal.
import "../../pay/[token]/pay.css";
import "./report.css";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { svt } from "../../../lib/serviceText.js";
import { OPEN_STATUSES } from "../../../lib/service.js";
import ReportForm from "./ReportForm.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const LANGS = ["en", "ro", "ru", "uk"];
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

export default async function ReportPage(props) {
  const { token } = await props.params;
  if (!TOKEN.test(String(token || ""))) notFound();
  const db = supabaseAdmin();
  const { data: p, error } = await db.from("projects").select("id, company_id, title, client_name, client_lang, address, status").eq("service_token", token).maybeSingle();
  if (error || !p || p.status !== "won") notFound();
  const [{ data: co }, { data: open }, { data: owner }] = await Promise.all([
    db.from("companies").select("name, short_name, logo_url, lang").eq("id", p.company_id).maybeSingle(),
    db.from("service_requests").select("status, created_at").eq("project_id", p.id).in("status", OPEN_STATUSES).order("created_at", { ascending: false }).limit(1),
    // the installer's phone is on the owner's profile (companies has none)
    db.from("profiles").select("phone").eq("company_id", p.company_id).eq("role", "owner").limit(1).maybeSingle(),
  ]);
  if (!co) notFound();
  const lang = LANGS.includes(p.client_lang) ? p.client_lang : LANGS.includes(co.lang) ? co.lang : "ro";
  const V = (k, v) => svt(k, lang, v);
  const company = co.short_name || co.name || "";
  const last = open?.[0] || null;
  const when = last ? new Date(last.created_at).toLocaleDateString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang], { day: "numeric", month: "long", timeZone: "Europe/Chisinau" }) : "";

  return (
    <main className="pay" lang={lang}>
      <article className="pay-card">
        <header className="pay-head">
          {/* the installer's logo, any size from their storage: a plain image, as on the pay page */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {co.logo_url ? <img src={co.logo_url} alt={company} className="pay-logo" /> : <span className="pay-co">{company}</span>}
          <div>
            <h1>{V("cp_title")}</h1>
            <p className="pay-sub">{V("cp_sub", { company })}{p.address ? ` ${p.address}` : ""}</p>
          </div>
        </header>
        {last && <p className="pay-note">{V("cp_open_p", { company, d: when, s: V("rs_" + last.status).toLowerCase() })}</p>}
        <ReportForm lang={lang} token={token} company={company} name={p.client_name || ""} />
        {owner?.phone && <footer className="pay-foot"><p>{V("cp_call", { company, phone: owner.phone })}</p></footer>}
      </article>
    </main>
  );
}
