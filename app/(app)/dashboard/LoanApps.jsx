// app/(app)/dashboard/LoanApps.jsx — the installer's loan applications, each
// client with the bank and where the bank has it (docs/FINANCING.md). Read
// on the installer's own session (row-level security keeps it to their
// workspace); lender names come from the server, since a workspace never
// reads the lenders table. Shows nothing until there is an application, or
// before supabase/add-financing.sql has run.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { lt } from "../../../lib/loanText.js";

export default async function LoanApps({ lang }) {
  const sb = await supabaseServer();
  const { data: apps, error } = await sb.from("loan_applications")
    .select("id, project_id, lender_id, applicant, amount_minor, currency, term_months, status, updated_at")
    .order("updated_at", { ascending: false }).limit(8);
  if (error || !apps?.length) return null;
  const ids = [...new Set(apps.map((a) => a.lender_id))];
  const { data: lenders } = await supabaseAdmin().from("lenders").select("id, name").in("id", ids);
  const name = new Map((lenders || []).map((l) => [l.id, l.name]));
  const nf = new Intl.NumberFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { maximumFractionDigits: 0 });
  const money = (minor, cur) => `${nf.format(Math.round(minor / 100))} ${cur === "MDL" ? "lei" : cur}`;

  return (
    <section className="dx-card dx-loans" aria-labelledby="dx-loans-h">
      <header className="dx-card-head"><div><h2 id="dx-loans-h">{lt("ln_h", lang)}</h2><p>{lt("ln_sub", lang)}</p></div></header>
      <ul className="dx-loan-list">
        {apps.map((a) => (
          <li key={a.id}>
            <Link href={a.project_id ? `/projects/${a.project_id}` : "/projects"} className="dx-loan">
              <span className="dx-loan-who"><b>{a.applicant?.name}</b>
                <small>{lt("ln_line", lang, { lender: name.get(a.lender_id) || "", amount: money(a.amount_minor, a.currency), term: lt("months_n", lang, { n: a.term_months }) })}</small></span>
              <span className={"dx-loan-st s-" + a.status}>{lt("st_" + a.status, lang)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
