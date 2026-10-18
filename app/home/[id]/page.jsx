// app/home/[id]/page.jsx — a homeowner's own page for one system
// (docs/MARKETPLACE.md): how the installation stands and what it produces
// (the signed offer's own after-signing view, ClientAfter.jsx, with the
// installer's contact and the referral link), then invoices and payments,
// documents, financing, warranties, maintenance requests and, once it runs, a
// rating. Read with the service role after checking the link to this
// homeowner; nothing here is editable but the requests and the rating.
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { currentHomeowner } from "../../../lib/homeServer.js";
import { normLang } from "../../../lib/i18n.js";
import { ht, HT } from "../../../lib/homeText.js";
import { nt } from "../../../lib/notifyText.js";
import { xt } from "../../../lib/integrationText.js";
import { lt } from "../../../lib/loanText.js";
import { moneyFormatter, numFor } from "../../../lib/money.js";
import { fmtDate } from "../../../lib/tz.js";
import { paymentSummary } from "../../../lib/billing.js";
import { projectInvoice } from "../../../lib/invoiceServer.js";
import { warrantyList } from "../../../lib/homeData.js";
import { findWarrantyInfo } from "../../../lib/supplierCatalog.js";
import { OPERATORS } from "../../../lib/mdGrid.js";
import { canReview } from "../../../lib/marketplace.js";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import ClientAfter from "../../p/[code]/ClientAfter.jsx";
import HomeTickets from "./HomeTickets.jsx";
import HomeReview from "./HomeReview.jsx";
import "../../p/[code]/proposal.css";
import "../home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "VoltMira", robots: { index: false, follow: false, nocache: true } };

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

async function offerData(code) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/proposal/${code}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? res.json() : null;
}

export default async function HomeSystem(props) {
  const { id } = await props.params;
  const user = await currentHomeowner();
  if (!user) redirect("/home/login");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = supabaseAdmin();
  const { data: link } = await db.from("homeowner_links").select("company_id").eq("user_id", user.id).eq("project_id", id).maybeSingle();
  if (!link) notFound();

  const [{ data: p }, { data: co }, { data: prop }] = await Promise.all([
    db.from("projects").select("*").eq("id", id).maybeSingle(),
    db.from("companies").select("*").eq("id", link.company_id).maybeSingle(),
    db.from("proposals").select("code, accepted_at").eq("project_id", id).not("accepted_at", "is", null).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!p || !co) notFound();
  const lang = normLang(co.lang || "ro");
  const loc = LOC[lang];
  const day = (d) => fmtDate(`${String(d).slice(0, 10)}T12:00:00Z`, loc, { day: "numeric", month: "long", year: "numeric" });
  const company = co.short_name || co.name || "";
  const data = prop?.code ? await offerData(prop.code) : null;

  // invoices and payments, in the invoice's currency
  const [pm, ef, la, gs, tk, rv] = await Promise.all([
    db.from("payments").select("amount_minor, currency, paid_at, method").eq("project_id", id).order("paid_at", { ascending: false }),
    db.from("efactura_submissions").select("fiscal_number, provider, status").eq("project_id", id).eq("status", "accepted").limit(1).maybeSingle(),
    prop?.code ? db.from("loan_applications").select("lender_id, status, monthly_minor, currency, term_months").eq("proposal_code", prop.code).order("created_at", { ascending: false }).limit(3) : { data: [] },
    db.from("grid_submissions").select("operator, status, reference").eq("project_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("maintenance_tickets").select("id, source, kind, title, status, visit_at, outcome, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("reviews").select("rating").eq("project_id", id).maybeSingle(),
  ]);
  const inv = p.invoice_no ? await projectInvoice(p, co) : null;
  const pay = inv ? paymentSummary(pm.data || [], inv.grossMinor, inv.cur) : null;
  const money = (minor, cur) => new Intl.NumberFormat(loc, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Math.round((Number(minor) || 0) / 100));
  let lenders = new Map();
  if (la.data?.length) {
    const { data: ln } = await db.from("lenders").select("id, name").in("id", [...new Set(la.data.map((a) => a.lender_id))]);
    lenders = new Map((ln || []).map((l) => [l.id, l.name]));
  }
  const commissioned = p.install_progress?.commission ? String(p.install_progress.commission).slice(0, 10) : null;
  const warranties = warrantyList({ bom: data?.bom || [], installYears: co.install_warranty_years, commissionedAt: commissioned, lookup: findWarrantyInfo });
  const may = canReview({ project: p, linked: true, existing: rv.data });
  const fmt = data ? moneyFormatter({ currency: data.company.currency, lang, fx: data.fx }) : null;
  const nf = numFor(lang);
  const sig = data?.signature;
  const level = sig ? nt(sig.level === "qualified" ? (sig.simulated ? "lvl_simulated" : "lvl_qualified") : "lvl_simple", lang) : null;
  const kw = Number(p.kw || 0).toLocaleString(loc, { maximumFractionDigits: 1 });

  // the words the two forms below need, in the homeowner's language
  const T = Object.fromEntries(Object.keys(HT).filter((k) => k.startsWith("hm_")).map((k) => [k, ht(k, lang)]));

  return (
    <main className="pp hm" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap hm-wrap">
        <header className="hm-top">
          <div>
            <p className="hm-kicker">{ht("hm_by", lang, { co: company })}</p>
            <h1 className="pp-h2">{p.title || ht("hm_title", lang)}</h1>
            <p className="pp-lead">{ht("hm_sys", lang, { kw })}{p.batt ? `, ${ht("hm_batt", lang, { n: Number(p.batt_kwh || 0).toLocaleString(loc) })}` : ""}</p>
          </div>
          <form action="/home/signout" method="post"><button type="submit" className="pp-btn pp-btn-text">{ht("hm_signout", lang)}</button></form>
        </header>

        {data?.after && <ClientAfter after={data.after} lang={lang} code={prop.code} company={data.company} nf={nf} fmt={fmt} preparedBy={data.preparedBy} market={data.inputs?.market} inHome />}

        <div className="hm-grid">
          <section className="pp-card hm-card" aria-labelledby="hm-bill">
            <h2 className="pp-h3" id="hm-bill">{ht("hm_bill_h", lang)}</h2>
            {!inv ? <p className="hm-muted">{ht("hm_bill_none", lang)}</p> : (
              <>
                <p className="hm-line"><b>{ht("hm_bill_inv", lang, { no: p.invoice_no })}</b>{ef.data?.provider === "sfs" && ef.data.fiscal_number ? <span className="hm-muted"> {ht("hm_bill_fiscal", lang, { n: ef.data.fiscal_number })}</span> : null}</p>
                <dl className="hm-facts">
                  <div><dt>{ht("hm_bill_total", lang)}</dt><dd>{money(inv.grossMinor, inv.cur)}</dd></div>
                  <div><dt>{ht("hm_bill_paid", lang)}</dt><dd>{money(pay.paidMinor, inv.cur)}</dd></div>
                  <div><dt>{ht("hm_bill_due", lang)}</dt><dd className={pay.settled ? "ok" : ""}>{pay.settled ? ht("hm_bill_settled", lang) : money(pay.dueMinor, inv.cur)}</dd></div>
                </dl>
                {(pm.data || []).length > 0 && (
                  <ul className="hm-rows">{pm.data.map((x, i) => <li key={i}><span>{day(x.paid_at)}</span><b>{money(x.amount_minor, x.currency)}</b></li>)}</ul>
                )}
              </>
            )}
          </section>

          <section className="pp-card hm-card" aria-labelledby="hm-docs">
            <h2 className="pp-h3" id="hm-docs">{ht("hm_docs_h", lang)}</h2>
            <ul className="hm-links">
              {prop?.code && <li><a href={`/p/${prop.code}`}>{ht("hm_doc_offer", lang)}</a>{level ? <span className="hm-muted"> {ht("hm_doc_sig", lang, { level })}</span> : null}</li>}
              {prop?.code && <li><a href={`/api/proposal/${prop.code}/pdf`} target="_blank" rel="noopener noreferrer">{ht("hm_doc_pdf", lang)}</a></li>}
              {gs.data && <li className="hm-muted">{ht("hm_doc_grid", lang, { op: OPERATORS[gs.data.operator]?.short || gs.data.operator, status: xt("gs_st_" + gs.data.status, lang), ref: gs.data.reference })}</li>}
            </ul>
          </section>

          <section className="pp-card hm-card" aria-labelledby="hm-fin">
            <h2 className="pp-h3" id="hm-fin">{ht("hm_fin_h", lang)}</h2>
            {!la.data?.length ? <p className="hm-muted">{ht("hm_fin_none", lang)}</p> : (
              <ul className="hm-rows">{la.data.map((a, i) => (
                <li key={i}><span>{ht("hm_fin_line", lang, { lender: lenders.get(a.lender_id) || "", status: lt("st_" + a.status, lang), monthly: money(a.monthly_minor, a.currency), months: a.term_months })}</span></li>
              ))}</ul>
            )}
          </section>

          <section className="pp-card hm-card" aria-labelledby="hm-war">
            <h2 className="pp-h3" id="hm-war">{ht("hm_war_h", lang)}</h2>
            {!warranties.length ? <p className="hm-muted">{ht("hm_war_none", lang)}</p> : (
              <ul className="hm-rows">{warranties.map((w, i) => (
                <li key={i}>
                  <span>{w.kind === "install" ? ht("hm_war_install", lang, { n: w.years }) : ht("hm_war_item", lang, { item: w.label, n: w.years })}{w.kind !== "install" && <small className="hm-muted"> {ht("hm_war_maker", lang)}</small>}</span>
                  <b>{w.until ? ht("hm_war_until", lang, { d: day(w.until) }) : ht("hm_war_from", lang)}</b>
                </li>
              ))}</ul>
            )}
          </section>
        </div>

        <HomeTickets projectId={id} lang={lang} T={T} company={company} tickets={tk.data || []} needsDb={!!tk.error} />
        <HomeReview projectId={id} T={T} may={may} existing={rv.data?.rating || null} />
      </div>
    </main>
  );
}
