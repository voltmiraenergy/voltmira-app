// app/pay/[token]/page.jsx — the client's pay page for one stage of their job (lib/milestones.js): the installer's
// invoice with its amount and due day, the bank details and the reference for the transfer, and a place to send the
// proof of transfer. Public, reached only by its unguessable link (pay_milestones.pay_token), never indexed; read with
// the service role by that token alone. In the client's language (projects.client_lang), else the installer's.
import "./pay.css";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { pt, money, dayName } from "../../../lib/payText.js";
import { payRef } from "../../../lib/milestones.js";
import PayClient from "./PayClient.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const LANGS = ["en", "ro", "ru", "uk"];
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export default async function PayPage(props) {
  const { token } = await props.params;
  if (!TOKEN.test(String(token || ""))) notFound();
  const db = supabaseAdmin();
  const { data: m, error } = await db.from("pay_milestones").select("*").eq("pay_token", token).maybeSingle();
  // a stage not invoiced yet has no page: the client gets the link only once it is
  if (error || !m || m.status === "planned") notFound();
  const [{ data: p }, { data: co }, { data: all }, { data: owner }] = await Promise.all([
    db.from("projects").select("id, title, client_name, client_lang, address").eq("id", m.project_id).maybeSingle(),
    db.from("companies").select("name, short_name, legal_name, legal_address, reg_no, iban, logo_url, lang").eq("id", m.company_id).maybeSingle(),
    db.from("pay_milestones").select("seq, amount_minor, status").eq("project_id", m.project_id),
    // the installer's phone is on the owner's profile (companies has none)
    db.from("profiles").select("phone").eq("company_id", m.company_id).eq("role", "owner").limit(1).maybeSingle(),
  ]);
  if (!p || !co) notFound();
  const lang = LANGS.includes(p.client_lang) ? p.client_lang : LANGS.includes(co.lang) ? co.lang : "ro";
  const P = (k, v) => pt(k, lang, v);
  const company = co.short_name || co.name || "";
  const stages = (all || []).filter((x) => x.status !== "void");
  const jobTotal = stages.reduce((t, x) => t + (Number(x.amount_minor) || 0), 0);
  const owed = Math.max(0, Number(m.amount_minor) - Number(m.paid_minor || 0));
  const paid = m.status === "paid" || owed === 0;
  const ref = payRef(m.invoice_no);

  return (
    <main className="pay" lang={lang}>
      <article className="pay-card">
        <header className="pay-head">
          {/* the installer's logo, any size from their storage: a plain image, as on the proposal page */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {co.logo_url ? <img src={co.logo_url} alt={company} className="pay-logo" /> : <span className="pay-co">{company}</span>}
          <div>
            <h1>{P("pp_title", { no: m.invoice_no })}</h1>
            <p className="pay-sub">{P("pp_from", { company: co.legal_name || company })}</p>
          </div>
        </header>

        {m.status === "void" ? <p className="pay-note">{P("pp_void")}</p> : (
          <>
            <section className={"pay-amt" + (paid ? " is-paid" : "")}>
              <span>{P("pp_amount")}</span>
              <b>{money(paid ? m.amount_minor : owed, m.currency, lang)}</b>
              {paid
                ? <p className="pay-paid">{P("pp_paid", { d: dayName(m.paid_at, lang) })}</p>
                : <p>{P("pp_due")} <strong>{dayName(m.due_on, lang)}</strong></p>}
            </section>

            <dl className="pay-facts">
              <div><dt>{P("pp_for")}</dt><dd>{p.title || p.client_name}{p.address ? <small>{p.address}</small> : null}</dd></div>
              <div><dt>{P("c_stage")}</dt><dd>{P("pp_stage", { n: m.seq, t: stages.length || m.seq, s: P("tr_" + m.trigger) })}<small>{P("pp_share", { p: Number(m.pct), v: money(jobTotal, m.currency, lang) })}</small></dd></div>
            </dl>

            {!paid && (
              <PayClient lang={lang} token={token} company={company}
                details={co.iban ? { to: co.legal_name || company, iban: co.iban, ref, idno: co.reg_no || "" } : null}
                proofSent={!!m.proof_at} />
            )}
          </>
        )}
        <footer className="pay-foot">
          <p>{P("pp_questions", { company })}{owner?.phone ? ` ${owner.phone}` : ""}</p>
        </footer>
      </article>
    </main>
  );
}
