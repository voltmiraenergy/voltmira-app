// lib/qsignFlow.js — the qualified signature of an offer, from the client's
// tap to the signed offer (docs/INTEGRATIONS.md):
//   start   a qualified_signatures row (pending) with the hash of what is
//           signed, then the provider's page (MSign; or the simulation)
//   decide  the simulation only: the client's choice on /sign/mock
//   finish  the provider's result, checked against the hash; a valid one
//           accepts the offer at the qualified level (lib/acceptProposal.js)
// Each step is audited. finish can run twice (a reload of the return URL):
// the second time it finds the work done and answers the same.
import { newRequestId, verifySignatureResult, mockContainer } from "./qsign.js";
import { writeAudit } from "./audit.js";

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));

/** Is qualified signing offered here: the real MSign, the simulation, or none. */
export function qsignMode(env = process.env) {
  if (env.MSIGN_ENABLED === "on") return "real";
  if (env.NODE_ENV !== "production" || env.QSIGN_MOCK === "on") return "mock";
  return null;
}

/**
 * @param {object} db
 * @param {object} a
 * @param {{ code, company_id, accepted_at }} a.prop
 * @param {string} a.documentHash
 * @param {object} a.adapter      lib/qsign.js
 * @param {(id: string) => string} a.returnFor  where the provider sends the client back, for a request id
 */
export async function startQualified(db, { prop, documentHash, adapter, returnFor }) {
  if (prop.accepted_at) return { ok: false, error: "already_signed" };
  const requestId = newRequestId();
  const { error } = await db.from("qualified_signatures").insert({
    company_id: prop.company_id, proposal_code: prop.code, provider: adapter.id, request_id: requestId,
    status: "pending", document_hash: documentHash, signer_name: "",
  });
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  const s = await adapter.start({ requestId, documentHash, documentName: prop.code, returnUrl: returnFor(requestId) });
  if (!s.ok) {
    await db.from("qualified_signatures").update({ status: "failed", verification: { error: s.error }, updated_at: new Date().toISOString() }).eq("request_id", requestId);
    return { ok: false, error: s.error };
  }
  await writeAudit(db, { companyId: prop.company_id, action: "qsign.start", entity: "proposal", entityId: prop.code, after: { requestId, provider: adapter.id, documentHash } });
  return { ok: true, requestId, redirectUrl: s.redirectUrl };
}

/** The simulation's sign / decline. Only a pending, simulated request. */
export async function decideMock(db, { requestId, decision, signer }) {
  const { data: row } = await db.from("qualified_signatures").select("*").eq("request_id", requestId).maybeSingle();
  if (!row || row.provider !== "msign_mock") return { ok: false, error: "not_found" };
  if (row.status !== "pending") return { ok: true, already: true, code: row.proposal_code };
  const name = String(signer || "").trim().slice(0, 120);
  const now = new Date().toISOString();
  if (decision === "sign") {
    if (name.length < 3) return { ok: false, error: "name" };
    const container = mockContainer({ requestId, documentHash: row.document_hash, signer: name, signedAt: now });
    await db.from("qualified_signatures").update({ status: "signed", signer_name: name, container, verification: { signer: name, signedAt: now }, updated_at: now }).eq("request_id", requestId).eq("status", "pending");
  } else {
    await db.from("qualified_signatures").update({ status: "failed", verification: { declined: true }, updated_at: now }).eq("request_id", requestId).eq("status", "pending");
  }
  return { ok: true, code: row.proposal_code };
}

/**
 * The client is back from the provider.
 * @param {(prop, sig) => Promise} a.accept  acceptProposal bound to its io
 * @returns {{ ok, code?, outcome: "signed" | "declined" | "pending" | "invalid", error? }}
 */
export async function finishQualified(db, { requestId, adapter, accept, ip = null, ua = null }) {
  const { data: row } = await db.from("qualified_signatures").select("*").eq("request_id", requestId).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  const code = row.proposal_code;
  if (row.verification?.valid === true) return { ok: true, code, outcome: "signed", already: true };
  if (row.provider !== adapter.id) return { ok: false, code, error: "provider_changed" };

  const r = await adapter.result(requestId, { row });
  if (!r.ok) return { ok: false, code, error: r.error };
  if (r.status === "pending") return { ok: true, code, outcome: "pending" };
  const now = new Date().toISOString();
  if (r.status === "failed") {
    await writeAudit(db, { companyId: row.company_id, action: "qsign.declined", entity: "proposal", entityId: code, after: { requestId } });
    return { ok: true, code, outcome: "declined" };
  }
  const v = verifySignatureResult(r, row.document_hash);
  await db.from("qualified_signatures").update({ status: v.valid ? "signed" : "failed", signer_name: v.signer || row.signer_name, container: r.container || row.container, verification: { ...v, checkedAt: now }, updated_at: now }).eq("request_id", requestId);
  await writeAudit(db, { companyId: row.company_id, action: v.valid ? "qsign.verified" : "qsign.invalid", entity: "proposal", entityId: code, after: { requestId, level: v.level, simulated: v.simulated, reason: v.reason || null, issuer: v.issuer } });
  if (!v.valid) return { ok: true, code, outcome: "invalid", error: v.reason };

  const { data: prop } = await db.from("proposals").select("code, company_id, project_id, accepted_at").eq("code", code).maybeSingle();
  if (!prop) return { ok: false, code, error: "not_found" };
  const acc = await accept(prop, { signerName: v.signer, ip, ua, level: "qualified", qualified: { requestId, provider: row.provider, simulated: v.simulated, issuer: v.issuer, documentHash: row.document_hash } });
  // an offer the client had already signed simply (another tab) stays signed that way
  return { ok: true, code, outcome: "signed", ...(acc?.already ? { already: true } : {}) };
}
