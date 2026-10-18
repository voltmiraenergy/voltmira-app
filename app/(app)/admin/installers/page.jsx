// app/(app)/admin/installers/page.jsx — the platform admin checks installers
// (docs/MARKETPLACE.md): those waiting first, each with the licence and
// insurance and a one-minute link to each document, then verify or reject
// with a note. Platform admins only; anyone else gets a 404.
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { normLang } from "../../../../lib/i18n.js";
import { at } from "../../../../lib/adminText.js";
import { verificationState } from "../../../../lib/marketplace.js";
import AdminNav, { ADMIN_CSS } from "../AdminNav.jsx";
import VerifyActions from "./VerifyActions.jsx";

export const dynamic = "force-dynamic";

export default async function InstallersAdmin() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  const db = supabaseAdmin();
  const { data: profiles, error } = await db.from("installer_profiles").select("*").order("updated_at", { ascending: false }).limit(300);
  const needsDb = !!error;
  const ids = (profiles || []).map((p) => p.company_id);
  const { data: cos } = ids.length ? await db.from("companies").select("id, name, legal_name, reg_no").in("id", ids) : { data: [] };
  const name = new Map((cos || []).map((c) => [c.id, `${c.legal_name || c.name}${c.reg_no ? `, IDNO ${c.reg_no}` : ""}`]));
  const rows = (profiles || []).map((p) => ({ ...p, v: verificationState(p) }));
  const pending = rows.filter((p) => p.verification === "pending");
  const rest = rows.filter((p) => p.verification !== "pending");
  const doc = (p, kind) => (p[kind + "_doc"] ? <a href={`/api/admin/installers?companyId=${p.company_id}&kind=${kind}`} target="_blank" rel="noopener noreferrer">{at("ai_doc", lang)}</a> : "");
  const T = { verify: at("ai_verify", lang), reject: at("ai_reject", lang), note: at("ai_note", lang), done: at("ai_done", lang) };
  const table = (list, actions) => (
    <table className="adm-table">
      <thead><tr><th>{at("ai_company", lang)}</th><th>{at("ai_licence", lang)}</th><th>{at("ai_insurance", lang)}</th><th>{at("ai_state", lang)}</th>{actions && <th />}</tr></thead>
      <tbody>
        {list.map((p) => (
          <tr key={p.company_id}>
            <td><b>{name.get(p.company_id) || p.company_id}</b><br /><small>{(p.regions || []).join(", ")}, {p.min_kw}-{p.max_kw} kW</small></td>
            <td>{p.licence_no}<br /><small>{p.licence_valid_to || ""}</small> {doc(p, "licence")}</td>
            <td>{p.insurer}<br /><small>{p.insurance_valid_to || ""}</small> {doc(p, "insurance")}</td>
            <td>{p.v.state}{p.verified_by ? <><br /><small>{p.verified_by}</small></> : null}</td>
            {actions && <td><VerifyActions companyId={p.company_id} T={T} /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="adm">
      <style>{ADMIN_CSS}</style>
      <AdminNav lang={lang} here="/admin/installers" />
      <h1 style={{ margin: "0 0 4px" }}>{at("ai_title", lang)}</h1>
      <p style={{ margin: "0 0 16px", color: "var(--muted)" }}>{at("ai_sub", lang)}</p>
      {needsDb && <p className="adm-warn">{at("ai_needs_db", lang)}</p>}
      {!needsDb && !rows.length && <p>{at("ai_none", lang)}</p>}
      {pending.length > 0 && <section className="adm-card"><h2>{at("ai_pending", lang)}</h2>{table(pending, true)}</section>}
      {rest.length > 0 && <section className="adm-card"><h2>{at("ai_rest", lang)}</h2>{table(rest, true)}</section>}
    </div>
  );
}
