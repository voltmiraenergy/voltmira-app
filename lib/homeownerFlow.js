// lib/homeownerFlow.js — a homeowner's account (docs/MARKETPLACE.md): linked to
// their system, signed in by a one-time link sent to their email, and the
// rating they may leave once it runs. Written with the service role after the
// caller's checks.
//
// The role is kept apart from installers: the account carries
// app_metadata.role = "homeowner" (only the service role can set it), the
// installer app sends such a session to /home, and an email that already
// belongs to an installer is never turned into a homeowner.
//
// io: { auth (supabase.auth.admin), sendEmail, emailConfigured, emailHtml(lang, vars) }
import { writeAudit } from "./audit.js";
import { canReview, reviewAuthor } from "./marketplace.js";

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
export const cleanEmail = (e) => String(e || "").trim().toLowerCase().slice(0, 200);
export const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/** The account for an email, made a homeowner's; or why it cannot be. */
async function homeownerAccount(db, auth, email) {
  const created = await auth.createUser({ email, email_confirm: true, app_metadata: { role: "homeowner" } });
  if (created.error && !/already|registered|exists/i.test(created.error.message || "")) return { ok: false, error: "auth_failed" };
  const link = await auth.generateLink({ type: "magiclink", email });
  if (link.error || !link.data?.user) return { ok: false, error: "auth_failed" };
  const user = link.data.user;
  const { data: prof } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (prof) return { ok: false, error: "installer_account" };
  if (user.app_metadata?.role !== "homeowner") await auth.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), role: "homeowner" } });
  const p = link.data.properties || {};
  return { ok: true, user, tokenHash: p.hashed_token, type: p.verification_type || "magiclink" };
}

/** The sign-in link: our own page verifies it, so it works with server-side sessions. */
export const enterUrl = (base, tokenHash, type = "magiclink") => `${String(base).replace(/\/+$/, "")}/home/enter?th=${encodeURIComponent(tokenHash)}&t=${encodeURIComponent(type)}`;

/**
 * Link an email to a project and send the sign-in link.
 * @param {object} a
 * @param {object} a.project   { id, company_id, client_email }
 * @param {"claim"|"invite"} a.via  claim: the client from their offer (only the email the quote has); invite: the installer
 */
export async function linkHomeowner(db, { project, email: raw, via, base, lang = "ro", company = "", actor = null, io }) {
  const email = cleanEmail(raw);
  if (!emailOk(email)) return { ok: false, error: "email" };
  if (via === "claim" && cleanEmail(project.client_email) !== email) return { ok: true, silent: true };
  // no account is made for a link that could not be stored
  const probe = await db.from("homeowner_links").select("id").limit(1);
  if (missing(probe.error)) return { ok: false, error: "needs_db" };
  const acc = await homeownerAccount(db, io.auth, email);
  if (!acc.ok) return acc;
  const ins = await db.from("homeowner_links").insert({ user_id: acc.user.id, project_id: project.id, company_id: project.company_id, email, via });
  if (ins.error && ins.error.code !== "23505") return { ok: false, error: missing(ins.error) ? "needs_db" : "save_failed" };
  if (!ins.error) await writeAudit(db, { companyId: project.company_id, actor, action: "homeowner.link", entity: "project", entityId: project.id, after: { via, userId: acc.user.id } });
  const sent = await sendEnterEmail(io, { email, lang, company, url: enterUrl(base, acc.tokenHash, acc.type) });
  return { ok: true, sent };
}

/** Sign in again: a link only when the email has a system; the same answer either way. */
export async function loginLink(db, { email: raw, base, io }) {
  const email = cleanEmail(raw);
  if (!emailOk(email)) return { ok: false, error: "email" };
  const { data: links, error } = await db.from("homeowner_links").select("company_id").eq("email", email).limit(1);
  if (missing(error)) return { ok: false, error: "needs_db" };
  if (!links?.length) return { ok: true };
  const acc = await homeownerAccount(db, io.auth, email);
  if (!acc.ok) return acc.error === "installer_account" ? acc : { ok: true };
  const { data: co } = await db.from("companies").select("name, short_name, lang").eq("id", links[0].company_id).maybeSingle();
  await sendEnterEmail(io, { email, lang: co?.lang || "ro", company: co?.short_name || co?.name || "", url: enterUrl(base, acc.tokenHash, acc.type) });
  return { ok: true };
}

async function sendEnterEmail(io, { email, lang, company, url }) {
  if (!io.emailConfigured()) return false;
  const { subject, html } = io.emailHtml(lang, { co: company, url });
  const r = await io.sendEmail({ to: email, subject, html });
  return !!r?.sent;
}

/** The projects a homeowner may see. */
export async function homeownerProjects(db, userId) {
  const { data, error } = await db.from("homeowner_links").select("project_id, company_id, email").eq("user_id", userId);
  if (missing(error)) return { needsDb: true, links: [] };
  return { needsDb: false, links: data || [] };
}

/** A rating from the homeowner, once the system runs. */
export async function submitReview(db, { userId, projectId, rating, body = "", io = null }) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return { ok: false, error: "rating" };
  const { data: link } = await db.from("homeowner_links").select("company_id").eq("user_id", userId).eq("project_id", projectId).maybeSingle();
  const { data: project } = await db.from("projects").select("id, company_id, client_name, address, install_progress").eq("id", projectId).maybeSingle();
  const { data: existing } = await db.from("reviews").select("id").eq("project_id", projectId).maybeSingle();
  const may = canReview({ project, linked: !!link, existing });
  if (!may.ok) return { ok: false, error: may.reason };
  const locality = String(project.address || "").split(",").map((s) => s.trim()).filter(Boolean).slice(-1)[0] || "";
  const row = { project_id: projectId, company_id: project.company_id, user_id: userId, rating: r, body: String(body || "").trim().slice(0, 1000), author: reviewAuthor(project.client_name, locality) };
  const ins = await db.from("reviews").insert(row).select("*").single();
  if (ins.error) return { ok: false, error: ins.error.code === "23505" ? "already" : "save_failed" };
  await writeAudit(db, { companyId: project.company_id, actor: { id: userId }, action: "review.create", entity: "project", entityId: projectId, after: { rating: r } });
  if (io?.notify) await io.notify({ project, review: ins.data });
  return { ok: true, review: ins.data };
}
