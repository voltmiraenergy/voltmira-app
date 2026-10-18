// lib/qsign.js — qualified electronic signature of an offer through MSign,
// with the signer identified by MPass (docs/INTEGRATIONS.md). Next to the
// click-to-sign (a simple electronic signature), this gives the offer a
// qualified signature under Moldova's law on electronic signatures.
//
// Every provider is reached through one interface:
//   adapter.start({ requestId, documentHash, documentName, signerName, returnUrl })
//     -> { ok: true, redirectUrl } | { ok: false, error }
//   adapter.result(requestId, ctx)
//     -> { ok: true, status: "signed" | "pending" | "failed", container?, signer?, issuer?, signedAt?, documentHash? }
//      | { ok: false, error }
// msignMockAdapter runs the whole flow with a simulated MPass page, and every
// result it gives says simulated: true; it is never shown as a real
// qualified signature. msignAdapter is the real one: it needs MSign
// onboarding (a service certificate and the endpoint, env MSIGN_*), and until
// then it answers "not_configured" rather than pretending.
import crypto from "node:crypto";

/** The hash of exactly what the client signs: the offer's code and its frozen figures. */
export function documentHashFor({ code, title = "", client = "", kw = 0, costEur = 0, currency = "", sentAt = "" }) {
  const canonical = JSON.stringify({ code, title, client, kw: Number(kw) || 0, costEur: Math.round(Number(costEur) || 0), currency, sentAt });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** A request id: unique, unguessable, safe in a URL. */
export const newRequestId = (prefix = "QS") => `${prefix}-${crypto.randomBytes(12).toString("hex")}`;

/**
 * Check a provider's result against the document the client was shown.
 * @returns {{ valid: boolean, level: "qualified" | null, simulated: boolean, reason?: string, signer, issuer, signedAt, documentHash }}
 */
export function verifySignatureResult(result, expectedHash) {
  const base = { signer: result?.signer || "", issuer: result?.issuer || "", signedAt: result?.signedAt || null, documentHash: result?.documentHash || "", simulated: !!result?.simulated };
  if (result?.status !== "signed") return { ...base, valid: false, level: null, reason: "not_signed" };
  if (!result.container) return { ...base, valid: false, level: null, reason: "no_container" };
  if (result.documentHash !== expectedHash) return { ...base, valid: false, level: null, reason: "document_changed" };
  if (!base.signer) return { ...base, valid: false, level: null, reason: "no_signer" };
  return { ...base, valid: true, level: "qualified" };
}

/**
 * The simulated MSign: the redirect goes to VoltMira's own /sign/mock page,
 * which records the decision in the qualified_signatures row; result() reads
 * it back. @param {{ baseUrl: string }} o
 */
export function msignMockAdapter({ baseUrl }) {
  return {
    id: "msign_mock",
    async start({ requestId, returnUrl }) {
      return { ok: true, redirectUrl: `${baseUrl}/sign/mock/${encodeURIComponent(requestId)}?return=${encodeURIComponent(returnUrl)}` };
    },
    async result(requestId, { row }) {
      if (!row) return { ok: false, error: "not_found" };
      if (row.status !== "signed") return { ok: true, status: row.status === "failed" ? "failed" : "pending" };
      return { ok: true, status: "signed", container: row.container, signer: row.verification?.signer || row.signer_name, issuer: "MOCK MPass (simulation)", signedAt: row.verification?.signedAt || row.updated_at, documentHash: row.document_hash, simulated: true };
    },
  };
}

/** The signed container a simulated signature carries: plainly labelled, never a real CAdES/XAdES. */
export function mockContainer({ requestId, documentHash, signer, signedAt }) {
  return Buffer.from(JSON.stringify({ type: "VOLTMIRA-MSIGN-SIMULATION", requestId, documentHash, signer, signedAt }), "utf8").toString("base64");
}

/** The real MSign. Needs MSIGN_ENDPOINT and the service certificate; until then, not configured. */
export function msignAdapter(env = process.env) {
  const configured = !!(env.MSIGN_ENDPOINT && env.MSIGN_CERT_PEM && env.MSIGN_KEY_PEM);
  return {
    id: "msign",
    async start() { return { ok: false, error: configured ? "not_implemented" : "not_configured" }; },
    async result() { return { ok: false, error: configured ? "not_implemented" : "not_configured" }; },
  };
}

/** Which provider: the real one once configured (MSIGN_ENABLED=on), else the simulation. */
export function qsignAdapterFor({ baseUrl, env = process.env }) {
  return env.MSIGN_ENABLED === "on" ? msignAdapter(env) : msignMockAdapter({ baseUrl });
}
