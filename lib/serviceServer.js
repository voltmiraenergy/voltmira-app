// lib/serviceServer.js — SERVER only. Service in the database (supabase/add-service.sql): a request created (by the
// client on their link, or by the installer), moved through its statuses with a history, the client's link to a
// system, and the reminders (the installer's Monday digest, the client's note 14 days before a yearly check). The
// rules are lib/service.js; this reads and writes with the service role after the caller has been checked.
import { randomBytes } from "node:crypto";
import { cleanRequest, nextStatuses, nextCheck, liveOn, replyLate, daysBetween, OPEN_STATUSES, DEFAULTS } from "./service.js";
import { svt } from "./serviceText.js";
import { mdDayKey, fmtDate } from "./tz.js";
import { writeAudit } from "./audit.js";

const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /service_|maintenance|warranties|does not exist|schema cache/i.test(e.message || ""));
const LANGS = ["en", "ro", "ru", "uk"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const newServiceToken = () => randomBytes(15).toString("base64url");

/** The job's "report a problem" token, made the first time it is asked for. */
export async function ensureServiceToken(db, project) {
  if (project.service_token) return project.service_token;
  const token = newServiceToken();
  const { data, error } = await db.from("projects").update({ service_token: token }).eq("id", project.id).is("service_token", null).select("service_token");
  if (error) return null;
  if (data?.length) return token;
  const { data: cur } = await db.from("projects").select("service_token").eq("id", project.id).maybeSingle();
  return cur?.service_token || null;
}

/**
 * A new request on a system.
 * @param {{ project: object, input: object, source: "client"|"installer", actor?: object, io?: { logActivity?, notifyOwner? } }} a
 * @returns {Promise<{ ok: boolean, request?: object, error?: string, fields?: string[] }>}
 */
export async function createRequest(db, { project, input, source, actor = null, io = {} }) {
  const c = cleanRequest(input, { source });
  if (!c.ok) return { ok: false, error: "invalid", fields: c.errors };
  const row = { ...c.row, company_id: project.company_id, project_id: project.id, created_by: actor?.id || null };
  if (source === "installer") row.first_reply_at = new Date().toISOString();   // the installer opening it is the answer
  const ins = await db.from("service_requests").insert(row).select("*").single();
  if (ins.error) return { ok: false, error: missing(ins.error) ? "needs_db" : "save_failed" };
  await db.from("service_request_events").insert({ request_id: ins.data.id, company_id: project.company_id, actor: source === "client" ? (row.contact_name || "client") : (actor?.email || ""), from_status: null, to_status: "new", note: "" });
  await writeAudit(db, { companyId: project.company_id, actor, action: "service.request", entity: "service_request", entityId: ins.data.id, before: null, after: { source, kind: row.kind, project_id: project.id } });
  if (io.logActivity) {
    await io.logActivity(db, { companyId: project.company_id, kind: "sys", key: "act_sv_request", params: { b: project.title || project.client_name || "", k: row.kind }, text: `Service request on ${project.title || ""}: ${row.kind}`, link: `/service?tab=requests&r=${ins.data.id}` });
  }
  if (io.notifyOwner && source === "client") await io.notifyOwner({ project, request: ins.data });
  return { ok: true, request: ins.data };
}

/**
 * A request moved to another status, with an optional note (the resolution, when resolved).
 * @returns {Promise<{ ok: boolean, request?: object, error?: string }>}
 */
export async function moveRequest(db, { request, to, note = "", visitId = null, actor = null, now = Date.now() }) {
  if (!nextStatuses(request.status).includes(to)) return { ok: false, error: "bad_status" };
  const at = new Date(now).toISOString();
  const set = { status: to, updated_at: at };
  if (!request.first_reply_at) set.first_reply_at = at;
  if (to === "resolved") { set.resolved_at = at; set.resolution = String(note || "").slice(0, 2000); }
  if (visitId) set.visit_id = visitId;
  const { data, error } = await db.from("service_requests").update(set).eq("id", request.id).eq("status", request.status).select("*");
  if (error) return { ok: false, error: "save_failed" };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "changed" };   // moved by someone else meanwhile
  await db.from("service_request_events").insert({ request_id: request.id, company_id: request.company_id, actor: actor?.email || "", from_status: request.status, to_status: to, note: String(note || "").slice(0, 2000) });
  await writeAudit(db, { companyId: request.company_id, actor, action: "service.status", entity: "service_request", entityId: request.id, before: { status: request.status }, after: { status: to } });
  return { ok: true, request: row };
}

/** The client's email that their request is resolved, in their language, the installer as the reply-to. */
export async function tellClientResolved({ co, project, request, ownerEmail = "", appUrl, io }) {
  if (!EMAIL_RE.test(project.client_email || "") || !io.emailConfigured()) return false;
  const lang = LANGS.includes(project.client_lang) ? project.client_lang : co.lang || "ro";
  const company = co.short_name || co.name || "";
  const subject = svt("cm_resolved_s", lang, { company });
  const { html } = io.ownerAlertEmail({
    lang, kicker: svt("cm_kicker", lang), heading: subject,
    rows: [[svt("r_kind", lang), svt("rk_" + request.kind, lang)], ...(request.resolution ? [[svt("cm_what", lang), request.resolution]] : [])],
    lead: svt("cm_resolved_l", lang), cta: project.service_token ? { label: svt("cm_report", lang), href: `/s/${project.service_token}` } : null,
    foot: svt("cm_foot", lang, { company }), appUrl,
  });
  const r = await io.sendEmail({ to: project.client_email, subject, html, replyTo: ownerEmail || undefined });
  return !!r?.sent;
}

/**
 * The reminders, from the daily cron: on Mondays the installer's digest (checks due within 30 days or overdue,
 * requests waiting past the answer time), and every day the client's note 14 days before a yearly check. Each goes
 * once (service_reminders).
 */
export async function sendServiceReminders(db, { io, now = Date.now(), appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com", budgetMs = 10_000 } = {}) {
  const tally = { digests: 0, clients: 0 };
  const started = Date.now();
  const today = mdDayKey(now);
  const { data: cos, error } = await db.from("companies").select("id, name, short_name, lang, service_reply_days, maintenance_months, maintenance_client_reminder");
  if (error) return { ...tally, needsDb: missing(error) };
  const monday = new Date(Date.parse(today + "T12:00:00Z")).getUTCDay() === 1;
  for (const co of cos || []) {
    if (Date.now() - started > budgetMs) break;
    const { data: projects } = await db.from("projects").select("id, title, client_name, client_email, client_lang, status, install_progress, commissioned_at, maintenance_off, service_token, sample").eq("company_id", co.id).eq("status", "won");
    const live = (projects || []).filter((p) => liveOn(p) && !p.sample);
    if (!live.length) continue;
    const { data: done } = await db.from("maintenance_checks").select("project_id, done_on").eq("company_id", co.id).not("done_on", "is", null);
    const last = new Map();
    for (const c of done || []) if (!last.get(c.project_id) || c.done_on > last.get(c.project_id)) last.set(c.project_id, c.done_on);
    const months = Number(co.maintenance_months) || DEFAULTS.checkMonths;
    const dues = live.map((p) => ({ p, due: nextCheck({ live: liveOn(p), lastDone: last.get(p.id) || null, months, off: p.maintenance_off }) })).filter((x) => x.due);
    const company = co.short_name || co.name || "";

    // the client, 14 days before
    if (co.maintenance_client_reminder !== false) {
      for (const { p, due } of dues) {
        const left = daysBetween(today, due);
        if (left < 0 || left > DEFAULTS.clientReminderDays || !EMAIL_RE.test(p.client_email || "")) continue;
        const claim = await db.from("service_reminders").insert({ key: `check-client:${p.id}:${due}` });
        if (claim.error) continue;
        if (!io.emailConfigured()) continue;
        const lang = LANGS.includes(p.client_lang) ? p.client_lang : co.lang || "ro";
        const d = fmtDate(due + "T12:00:00Z", { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang], { day: "numeric", month: "long" });
        const subject = svt("cm_check_s", lang, { d });
        const { html } = io.ownerAlertEmail({ lang, kicker: svt("cm_kicker", lang), heading: subject, lead: svt("cm_check_l", lang, { company }), foot: svt("cm_foot", lang, { company }), cta: p.service_token ? { label: svt("cm_report", lang), href: `/s/${p.service_token}` } : null, appUrl });
        const owner = await ownerOf(db, co.id);
        await io.sendEmail({ to: p.client_email, subject, html, replyTo: owner || undefined });
        tally.clients++;
      }
    }

    // the installer, on Mondays
    if (monday) {
      const checks = dues.filter((x) => daysBetween(today, x.due) <= 30).length;
      const { data: reqs } = await db.from("service_requests").select("status, first_reply_at, created_at").eq("company_id", co.id).in("status", OPEN_STATUSES);
      const waiting = (reqs || []).filter((r) => replyLate(r, Number(co.service_reply_days) || DEFAULTS.replyDays, today)).length;
      if (!checks && !waiting) continue;
      const claim = await db.from("service_reminders").insert({ key: `digest:${co.id}:${today}` });
      if (claim.error) continue;
      const owner = await ownerOf(db, co.id);
      if (!owner || !io.emailConfigured()) continue;
      const lang = co.lang || "ro";
      const subject = svt("own_digest_s", lang, { c: checks, r: waiting });
      const { html } = io.ownerAlertEmail({ lang, kicker: svt("title", lang), heading: subject, lead: svt("own_digest_p", lang), cta: { label: svt("title", lang), href: "/service" }, appUrl });
      await io.sendEmail({ to: owner, subject, html });
      tally.digests++;
    }
  }
  return tally;
}

async function ownerOf(db, companyId) {
  const { data } = await db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").limit(1).maybeSingle();
  return data?.email || "";
}
