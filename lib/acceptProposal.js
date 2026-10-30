// lib/acceptProposal.js — what happens when a client signs an offer, whichever
// way they signed: the click-to-sign on the offer page (a simple electronic
// signature) or MSign with MPass (a qualified one, lib/qsignFlow.js).
//
// Only the first signature counts: the write is conditional on accepted_at
// still being empty, so two tabs, a double tap or a replayed MSign return
// accept the offer once. Then the quote is won, whatever the proposal
// assistant agreed becomes part of what was signed, the installer hears
// about it (Activity, email, CRM) and the audit log records the signature
// with its legal level.
//
// io carries the side effects, so the flow is testable:
//   { acceptOffers(db, code), logActivity(db, row), notifyAccepted(db, prop, info), sendCrmWebhook(companyId, event, data),
//     feeOnWin?(db, projectId) }
// lib/acceptIo.js gives the real ones.
import { escapeHtml } from "./safe.js";
import { writeAudit } from "./audit.js";
import { opsAlert } from "./opsAlert.js";

export const SIGNATURE_LEVELS = ["simple", "qualified"];

/**
 * @param {object} db    service-role client
 * @param {{ code, company_id, project_id }} prop
 * @param {object} s
 * @param {string|null} [s.signature]   the drawn PNG data URL (simple only)
 * @param {string|null} [s.signerName]
 * @param {string|null} [s.ip]
 * @param {string|null} [s.ua]
 * @param {"simple"|"qualified"} [s.level]
 * @param {object|null} [s.qualified]  { requestId, provider, simulated, issuer, documentHash } for the audit
 * @param {object} io
 * @returns {Promise<{ ok: true, already?: true, acceptedAt?: string }>}
 */
export async function acceptProposal(db, prop, { signature = null, signerName = null, ip = null, ua = null, level = "simple", qualified = null } = {}, io) {
  const lvl = SIGNATURE_LEVELS.includes(level) ? level : "simple";
  const stamp = new Date().toISOString();
  const base = { accepted_at: stamp, signature, signer_name: signerName, signed_ip: ip, signed_ua: ua };
  // richest write first; a database without the newer columns still accepts
  // (add-integrations.sql adds signature_level, add-proposal-signature.sql the rest)
  const writes = [{ ...base, signature_level: lvl }, base, { accepted_at: stamp }];
  let first = null;
  for (const row of writes) {
    const { data, error } = await db.from("proposals").update(row).eq("code", prop.code).is("accepted_at", null).select("code");
    if (!error) { first = Array.isArray(data) && data.length > 0; break; }
  }
  if (first === null) throw new Error("accept_write_failed");
  if (!first) return { ok: true, already: true };

  // a client's signature wins the job, also one marked lost or still a draft: it is the client's word, and a
  // job left lost cannot be invoiced or charged a fee
  // Checked and tried twice: a job left "sent" after the client signed gets no fee, and the daily sweep looks at
  // signed jobs only. If it still fails the signature stands (it is the client's word, already saved) and the miss
  // is logged and audited, so it is fixed by hand rather than lost.
  let wonErr = null;
  for (let i = 0; i < 2; i++) {
    ({ error: wonErr } = await db.from("projects").update({ status: "won" }).eq("id", prop.project_id).neq("status", "won"));
    if (!wonErr) break;
  }
  if (wonErr) {
    opsAlert("signature.project_not_won", { proposal: prop.code, project: prop.project_id, reason: String(wonErr.message || "") });
    await writeAudit(db, { companyId: prop.company_id, actor: null, action: "proposal.signed_status_failed", entity: "project", entityId: prop.project_id, before: null, after: { proposal: prop.code, error: String(wonErr.message || "").slice(0, 200) } });
  }
  // the fee per won project (lib/jobFeeServer.js): never in the way of the signature itself
  if (io.feeOnWin) await io.feeOnWin(db, prop.project_id);
  // name the human, not the URL slug
  const { data: proj } = await db.from("projects").select("title, client_name").eq("id", prop.project_id).maybeSingle();
  const who = proj?.client_name || proj?.title || prop.code;
  const agreed = await io.acceptOffers(db, prop.code);
  const pct = Number(agreed?.discount?.pct) || 0;
  await io.logActivity(db, {
    companyId: prop.company_id, kind: "won", key: pct ? "act_accepted_offer" : "act_proposal_accepted",
    params: { b: who, ...(pct ? { n: pct } : {}) },
    text: pct
      ? `<b>${escapeHtml(who)}</b> accepted your proposal with the ${pct}% discount the assistant offered`
      : `<b>${escapeHtml(who)}</b> accepted your proposal`,
    link: `/projects/${prop.project_id}`,
  });
  await writeAudit(db, {
    companyId: prop.company_id, actor: null, action: "proposal.signed", entity: "proposal", entityId: prop.code,
    before: { accepted_at: null },
    // who signed is on the proposal row; the audit keeps the level and the evidence
    after: { accepted_at: stamp, level: lvl, ip: ip || null, ...(qualified ? { qualified } : {}), discountPct: pct || 0 },
  });
  await io.notifyAccepted(db, prop, { who, title: proj?.title || prop.code, signer: signerName, pct, level: lvl, simulated: !!qualified?.simulated });
  await io.sendCrmWebhook(prop.company_id, "proposal.won", { projectId: prop.project_id, title: proj?.title || "", client_name: proj?.client_name || "", via: "client", signature_level: lvl });
  return { ok: true, acceptedAt: stamp };
}
