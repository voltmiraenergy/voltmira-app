// lib/profileFlow.js — an installer's public profile and its verification
// (docs/MARKETPLACE.md): saved from the marketplace page, documents stored
// privately, a check asked for, and the platform's decision. Written with the
// service role after the caller's checks; every step that matters audited.
import { cleanProfile, needsRecheck, verificationMissing, slugFor } from "./marketplace.js";
import { writeAudit } from "./audit.js";

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
const now = () => new Date().toISOString();
const CHECKED = ["verification", "licence_no", "licence_valid_to", "licence_doc", "insurer", "insurance_valid_to", "insurance_doc"];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]));

export const DOC_KINDS = ["licence", "insurance"];
export const DOC_TYPES = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const DOC_MAX = 10 * 1024 * 1024;

export async function loadProfile(db, companyId) {
  const { data, error } = await db.from("installer_profiles").select("*").eq("company_id", companyId).maybeSingle();
  if (missing(error)) return { needsDb: true, profile: null };
  return { needsDb: false, profile: data || null };
}

/** A public name no other installer has. */
async function freeSlug(db, companyId, name) {
  const base = slugFor(name);
  for (let i = 0; i < 20; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    const { data } = await db.from("installer_profiles").select("company_id").eq("slug", s).maybeSingle();
    if (!data || data.company_id === companyId) return s;
  }
  return `${base}-${companyId.slice(0, 6)}`;
}

/**
 * @param {object} a
 * @param {{ id, name, legal_name }} a.company
 * @param {object} a.input       the form
 * @param {string[]} a.raionIds
 */
export async function saveProfile(db, { company, input, raionIds, actor }) {
  const c = cleanProfile(input, raionIds);
  if (!c.ok) return { ok: false, error: "invalid", fields: c.errors };
  const { needsDb, profile: before } = await loadProfile(db, company.id);
  if (needsDb) return { ok: false, error: "needs_db" };
  const row = { company_id: company.id, ...c.value, updated_at: now(), slug: before?.slug || await freeSlug(db, company.id, company.name || company.legal_name) };
  if (needsRecheck(before, row)) Object.assign(row, { verification: "pending", verification_note: "", verified_at: null });
  const { error } = await db.from("installer_profiles").upsert(row);
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  const after = { ...(before || {}), ...row };
  if (CHECKED.some((k) => String(before?.[k] ?? "") !== String(after[k] ?? ""))) {
    await writeAudit(db, { companyId: company.id, actor, action: "profile.update", entity: "installer_profile", entityId: company.id, before: before ? pick(before, CHECKED) : null, after: pick(after, CHECKED) });
  }
  return { ok: true, profile: after };
}

/**
 * Store a licence or insurance document in the private bucket.
 * @param {object} storage  supabase.storage
 * @param {{ bytes: Uint8Array, mime: string }} a.file
 */
export async function attachDoc(db, storage, { companyId, kind, file, actor }) {
  if (!DOC_KINDS.includes(kind)) return { ok: false, error: "kind" };
  const ext = DOC_TYPES[file?.mime];
  if (!ext) return { ok: false, error: "type" };
  if (!(file.bytes?.length > 0) || file.bytes.length > DOC_MAX) return { ok: false, error: "size" };
  const { needsDb, profile } = await loadProfile(db, companyId);
  if (needsDb) return { ok: false, error: "needs_db" };
  if (!profile) return { ok: false, error: "save_profile_first" };
  const path = `${companyId}/${kind}-${Date.now()}.${ext}`;
  const up = await storage.from("verify-docs").upload(path, file.bytes, { contentType: file.mime, upsert: false });
  if (up.error) return { ok: false, error: "upload_failed" };
  const field = kind === "licence" ? "licence_doc" : "insurance_doc";
  const set = { [field]: path, updated_at: now() };
  if (needsRecheck(profile, set)) Object.assign(set, { verification: "pending", verified_at: null });
  await db.from("installer_profiles").update(set).eq("company_id", companyId);
  await writeAudit(db, { companyId, actor, action: "profile.document", entity: "installer_profile", entityId: companyId, before: { [field]: profile[field] || null, verification: profile.verification }, after: { [field]: path, verification: set.verification || profile.verification } });
  return { ok: true, path };
}

/** Ask the platform to check the profile: only once everything is given. */
export async function requestVerification(db, { companyId, actor, io = null }) {
  const { needsDb, profile } = await loadProfile(db, companyId);
  if (needsDb) return { ok: false, error: "needs_db" };
  const miss = verificationMissing(profile);
  if (miss.length) return { ok: false, error: "incomplete", missing: miss };
  if (profile.verification === "verified" || profile.verification === "pending") return { ok: true, already: true };
  await db.from("installer_profiles").update({ verification: "pending", verification_note: "", updated_at: now() }).eq("company_id", companyId);
  await writeAudit(db, { companyId, actor, action: "profile.verify_request", entity: "installer_profile", entityId: companyId, before: { verification: profile.verification }, after: { verification: "pending" } });
  await io?.notify?.({ companyId, profile });
  return { ok: true };
}

/** The platform admin's decision. */
export async function decideVerification(db, { companyId, decision, note = "", admin, io = null }) {
  if (!["verified", "rejected"].includes(decision)) return { ok: false, error: "decision" };
  const { needsDb, profile } = await loadProfile(db, companyId);
  if (needsDb) return { ok: false, error: "needs_db" };
  if (!profile) return { ok: false, error: "not_found" };
  if (decision === "verified" && verificationMissing(profile).length) return { ok: false, error: "incomplete" };
  const set = { verification: decision, verification_note: String(note || "").slice(0, 500), verified_at: decision === "verified" ? now() : null, verified_by: decision === "verified" ? String(admin?.email || "") : "", updated_at: now() };
  await db.from("installer_profiles").update(set).eq("company_id", companyId);
  await writeAudit(db, { companyId, actor: admin, action: "profile.verify_decision", entity: "installer_profile", entityId: companyId, before: { verification: profile.verification }, after: { verification: decision, note: set.verification_note } });
  await io?.notify?.({ companyId, decision, note: set.verification_note });
  return { ok: true };
}
