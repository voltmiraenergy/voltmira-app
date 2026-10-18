// app/sign/mock/[id]/page.jsx — the simulated MPass and MSign step of a
// qualified signature (docs/INTEGRATIONS.md). It says on its face that it is a
// test, is never indexed, and exists only where the simulation is on
// (lib/qsignFlow.js qsignMode): with MSign configured the client goes to
// MSign itself and this page answers 404.
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { qsignMode } from "../../../../lib/qsignFlow.js";
import { normLang } from "../../../../lib/i18n.js";
import HtmlLang from "../../../../lib/HtmlLang.jsx";
import { ppt } from "../../../p/[code]/text.js";
import MockSign from "./MockSign.jsx";
import "../../../p/[code]/proposal.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "VoltMira", robots: { index: false, follow: false, nocache: true } };

export default async function MockSignPage(props) {
  const { id } = await props.params;
  if (qsignMode() !== "mock" || !/^QS-[0-9a-f]{24}$/.test(String(id || ""))) notFound();
  const db = supabaseAdmin();
  const { data: row } = await db.from("qualified_signatures").select("request_id, proposal_code, company_id, provider, status, document_hash").eq("request_id", id).maybeSingle();
  if (!row || row.provider !== "msign_mock") notFound();
  const [{ data: co }, { data: prop }] = await Promise.all([
    db.from("companies").select("lang").eq("id", row.company_id).maybeSingle(),
    db.from("proposals").select("snapshot").eq("code", row.proposal_code).maybeSingle(),
  ]);
  const lang = normLang(co?.lang || "ro");
  const title = prop?.snapshot?.title || row.proposal_code;
  const T = Object.fromEntries(["qm_name", "qm_sign", "qm_decline", "qm_done", "qm_back", "qs_error"].map((k) => [k, ppt(k, lang)]));

  return (
    <main className="pp" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap qm">
        <h1 className="pp-h2">{ppt("qm_title", lang)}</h1>
        <p className="qm-warn" role="note">{ppt("qm_warn", lang)}</p>
        <section className="pp-card qm-card">
          <dl className="qm-facts">
            <div><dt>{ppt("qm_doc", lang)}</dt><dd>{title}</dd></div>
            <div><dt>{ppt("qm_hash", lang)}</dt><dd className="qm-hash">{row.document_hash}</dd></div>
          </dl>
          <MockSign requestId={row.request_id} pending={row.status === "pending"} code={row.proposal_code} T={T} />
        </section>
      </div>
    </main>
  );
}
