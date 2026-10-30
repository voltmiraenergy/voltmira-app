"use server";
// lib/serviceActions.js — the installer's side of Service (/service, docs/features/phase5.md): every installed system
// with its health, portal and next check; the requests; the yearly checks; the warranties; and what is done from
// those screens. Reads go through the signed-in session (row security; a Sales member sees only the jobs they own);
// writes through the service role once that is checked.
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { currentCompany, currentUser, currentActor } from "./session.js";
import { projectVisibility } from "./projectAccess.js";
import { systemHealth, needsAttention, liveOn, nextCheck, checkState, replyLate, warrantiesFor, endingSoon, OPEN_STATUSES, WARRANTY_ITEMS, DEFAULTS, visitOwnedBy } from "./service.js";
import { createRequest, moveRequest, ensureServiceToken, tellClientResolved } from "./serviceServer.js";
import { findWarrantyInfo } from "./supplierCatalog.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { logActivity } from "./activity.js";
import { mdDayKey } from "./tz.js";
import { writeAudit } from "./audit.js";

const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /service_|maintenance|warranties|does not exist|schema cache/i.test(e.message || ""));
const UUID = /^[0-9a-f-]{36}$/i;
const PROJECT_COLS = "id, company_id, owner_id, title, client_name, client_email, client_lang, address, lat, lon, kw, yield_per_kwp, monthly_yield_shape, market, status, install_progress, commissioned_at, bom, maintenance_off, service_token";

async function who() {
  const [user, co] = await Promise.all([currentUser(), currentCompany()]);
  if (!user || !co) return null;
  const sb = await supabaseServer();
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { user, co, sb, isOwner: me?.role === "owner", canSee: await projectVisibility(user, co) };
}

async function myProject(w, projectId, cols = "*") {
  if (!UUID.test(String(projectId || ""))) return null;
  const { data: p } = await w.sb.from("projects").select(cols).eq("id", projectId).maybeSingle();
  return p && p.company_id === w.co.id && w.canSee(p) ? p : null;
}

async function myRequest(w, id) {
  if (!UUID.test(String(id || ""))) return null;
  const { data: r } = await w.sb.from("service_requests").select("*").eq("id", id).maybeSingle();
  return r && r.company_id === w.co.id && (await myProject(w, r.project_id, "id, company_id, owner_id")) ? r : null;
}

/** Everything the four tabs show. */
/** A crew visit id from the browser, only if it is this workspace's visit on this project (else null). */
async function myVisitId(w, visitId, projectId) {
  if (!UUID.test(String(visitId || ""))) return null;
  const { data } = await supabaseAdmin().from("crew_visits").select("id, company_id, project_id").eq("id", visitId).maybeSingle();
  return visitOwnedBy(data, w.co.id, projectId) ? data.id : null;
}

export async function loadService() {
  const w = await who();
  if (!w) return { error: "unauthorized" };
  const { sb, co } = w;
  const today = mdDayKey(Date.now());
  const settings = { replyDays: Number(co.service_reply_days) || DEFAULTS.replyDays, months: Number(co.maintenance_months) || DEFAULTS.checkMonths, clientReminder: co.maintenance_client_reminder !== false };
  // try the columns add-service.sql adds; without them, the jobs as they are
  let pq = await sb.from("projects").select(PROJECT_COLS).eq("status", "won").limit(1000);
  let needsDb = false;
  if (pq.error && missing(pq.error)) { needsDb = true; pq = await sb.from("projects").select(PROJECT_COLS.replace(", maintenance_off, service_token", "")).eq("status", "won").limit(1000); }
  const projects = (pq.data || []).filter((p) => w.canSee(p) && liveOn(p));
  const ids = projects.map((p) => p.id);
  // production_readings.month is a date (the first of the month): from January of last year
  const since = `${Number(today.slice(0, 4)) - 1}-01-01`;
  const [rd, st, rq, ch, wa, cr, vs, js] = await Promise.all([
    ids.length ? sb.from("production_readings").select("project_id, month, kwh").in("project_id", ids).gte("month", since) : { data: [] },
    ids.length ? sb.from("inverter_stations").select("project_id, last_month").in("project_id", ids) : { data: [] },
    sb.from("service_requests").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("maintenance_checks").select("*").order("due_on", { ascending: false }).limit(2000),
    sb.from("warranties").select("*").limit(5000),
    sb.from("crews").select("id, name, color, active").order("name"),
    sb.from("crew_visits").select("id, project_id, kind, starts_at").gte("starts_at", new Date(Date.now() - 86_400_000).toISOString()).in("kind", ["service", "maintenance"]).order("starts_at"),
    // the serial numbers the crew recorded on site (add-jobs-board.sql)
    ids.length ? sb.from("job_site").select("project_id, record").in("project_id", ids) : { data: [] },
  ]);
  const serialsBy = new Map((js.data || []).map((x) => [x.project_id, x.record?.serials || {}]));
  if (missing(rq.error) || missing(ch.error)) needsDb = true;
  const readingsBy = new Map();
  for (const r of rd.data || []) readingsBy.set(r.project_id, [...(readingsBy.get(r.project_id) || []), r]);
  const portal = new Set((st.data || []).map((s) => s.project_id));
  const lastDone = new Map(), planned = new Map();
  for (const c of ch.data || []) {
    if (c.done_on && (!lastDone.get(c.project_id) || c.done_on > lastDone.get(c.project_id))) lastDone.set(c.project_id, c.done_on);
  }
  for (const v of vs.data || []) if (v.kind === "maintenance" && !planned.has(v.project_id)) planned.set(v.project_id, v.starts_at);
  const requests = (rq.data || []).filter((r) => projects.some((p) => p.id === r.project_id));
  const openBy = new Map();
  for (const r of requests) if (OPEN_STATUSES.includes(r.status)) openBy.set(r.project_id, (openBy.get(r.project_id) || 0) + 1);
  const savedW = new Map();
  for (const x of wa.data || []) savedW.set(x.project_id, [...(savedW.get(x.project_id) || []), x]);

  const systems = projects.map((p) => {
    const health = systemHealth(p, readingsBy.get(p.id) || [], today);
    const live = liveOn(p);
    const due = nextCheck({ live, lastDone: lastDone.get(p.id) || null, months: settings.months, off: !!p.maintenance_off });
    const warranties = warrantiesFor({ live, bom: p.bom, installYears: co.install_warranty_years, saved: savedW.get(p.id) || [], lookup: findWarrantyInfo });
    return {
      id: p.id, title: p.title || "", client: p.client_name || "", address: p.address || "", kw: Number(p.kw) || 0, live,
      lat: p.lat ?? null, lon: p.lon ?? null, clientLang: p.client_lang || null,
      health, attention: needsAttention(health), portal: portal.has(p.id), open: openBy.get(p.id) || 0,
      due, dueState: checkState(due, today), lastDone: lastDone.get(p.id) || null, plannedAt: planned.get(p.id) || null, checksOff: !!p.maintenance_off,
      token: p.service_token || null,
      warranties: warranties.map((x) => ({ ...x, serials: (serialsBy.get(p.id) || {})[{ panels: "panel", performance: "panel", inverter: "inverter", battery: "battery" }[x.item]] || [] })),
    };
  }).sort((a, b) => Number(b.attention) - Number(a.attention) || a.title.localeCompare(b.title));
  const name = new Map(systems.map((s) => [s.id, s.title || s.client]));
  const reqRows = requests.map((r) => ({ ...r, system: name.get(r.project_id) || "", late: replyLate(r, settings.replyDays, today) }));
  const allW = systems.flatMap((s) => s.warranties.map((x) => ({ ...x, projectId: s.id, system: s.title || s.client })));
  return {
    needsDb, today, settings, isOwner: w.isOwner, lang: co.lang || "ro",
    systems, requests: reqRows, crews: (cr.data || []).filter((c) => c.active !== false),
    warrantySoon: endingSoon(allW, today),
    tiles: {
      live: systems.length, kw: Math.round(systems.reduce((t, s) => t + s.kw, 0) * 10) / 10,
      attention: systems.filter((s) => s.attention).length,
      open: reqRows.filter((r) => OPEN_STATUSES.includes(r.status)).length, late: reqRows.filter((r) => r.late).length,
      checks: systems.filter((s) => s.dueState === "soon" || s.dueState === "overdue").length, overdue: systems.filter((s) => s.dueState === "overdue").length,
    },
  };
}

/** A request opened by the installer (after a call or a message). */
export async function openRequest(projectId, input) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId);
  if (!p) return { ok: false, error: "not_found" };
  const r = await createRequest(supabaseAdmin(), { project: p, input, source: "installer", actor: await currentActor(), io: { logActivity } });
  if (r.ok) revalidatePath("/service");
  return r.ok ? { ok: true, id: r.request.id } : r;
}

/** A request moved on: planned (with its visit), in progress, resolved (what was done, and the client told). */
export async function moveRequestTo(id, to, { note = "", visitId = null, tellClient = false } = {}) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const req = await myRequest(w, id);
  if (!req) return { ok: false, error: "not_found" };
  const db = supabaseAdmin();
  // a visit is linked only if it is this workspace's, on this request's system (never another company's id)
  const r = await moveRequest(db, { request: req, to, note, visitId: await myVisitId(w, visitId, req.project_id), actor: await currentActor() });
  if (r.ok && to === "resolved" && tellClient) {
    const { data: p } = await db.from("projects").select("*").eq("id", req.project_id).maybeSingle();
    if (p) {
      const token = await ensureServiceToken(db, p);
      await tellClientResolved({ co: w.co, project: { ...p, service_token: token }, request: r.request, ownerEmail: w.user.email, appUrl: process.env.NEXT_PUBLIC_APP_URL, io: { sendEmail, emailConfigured, ownerAlertEmail } });
    }
  }
  if (r.ok) revalidatePath("/service");
  return r.ok ? { ok: true } : r;
}

/** A request's history and photos (short-lived links). */
export async function requestDetail(id) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const req = await myRequest(w, id);
  if (!req) return { ok: false, error: "not_found" };
  const [{ data: events }, { data: photos }] = await Promise.all([
    w.sb.from("service_request_events").select("actor, from_status, to_status, note, created_at").eq("request_id", id).order("created_at"),
    w.sb.from("service_photos").select("path").eq("request_id", id),
  ]);
  let urls = [];
  if (photos?.length) {
    const { data } = await supabaseAdmin().storage.from("service-photos").createSignedUrls(photos.map((x) => x.path), 600);
    urls = (data || []).map((x) => x.signedUrl).filter(Boolean);
  }
  return { ok: true, events: events || [], photos: urls };
}

/** A visit planned for a yearly check (lib/jobActions.js saveVisit made it): the check is booked on it. */
export async function bookCheck(projectId, { visitId, dueOn }) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id");
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(String(dueOn || ""))) return { ok: false, error: "invalid" };
  visitId = await myVisitId(w, visitId, p.id);
  if (!visitId) return { ok: false, error: "invalid" };
  const db = supabaseAdmin();
  const { data: cur } = await db.from("maintenance_checks").select("id").eq("project_id", p.id).eq("due_on", dueOn).maybeSingle();
  const q = cur ? db.from("maintenance_checks").update({ visit_id: visitId }).eq("id", cur.id) : db.from("maintenance_checks").insert({ company_id: w.co.id, project_id: p.id, due_on: dueOn, visit_id: visitId });
  const { error } = await q;
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  revalidatePath("/service");
  return { ok: true };
}

/** A yearly check done on a day: the next one counts from it. */
export async function markCheckDone(projectId, { dueOn, day, note = "" }) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id");
  const today = mdDayKey(Date.now());
  const done = /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) && day <= today ? day : today;
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(String(dueOn || ""))) return { ok: false, error: "invalid" };
  const db = supabaseAdmin();
  const { data: cur } = await db.from("maintenance_checks").select("id").eq("project_id", p.id).eq("due_on", dueOn).maybeSingle();
  const row = { done_on: done, note: String(note || "").slice(0, 1000) };
  const { error } = cur ? await db.from("maintenance_checks").update(row).eq("id", cur.id) : await db.from("maintenance_checks").insert({ company_id: w.co.id, project_id: p.id, due_on: dueOn, ...row });
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  await writeAudit(db, { companyId: w.co.id, actor: await currentActor(), action: "service.check_done", entity: "project", entityId: p.id, before: null, after: { due_on: dueOn, done_on: done } });
  revalidatePath("/service");
  return { ok: true };
}

/** Yearly checks off (or on again) for one job. */
export async function setChecksOff(projectId, off) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id");
  if (!p) return { ok: false, error: "not_found" };
  const { error } = await supabaseAdmin().from("projects").update({ maintenance_off: !!off }).eq("id", p.id);
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  revalidatePath("/service");
  return { ok: true };
}

/** One warranty of a system, set by hand (years, product, from when). */
export async function saveWarranty(projectId, item, { product = "", years = "", startsOn = "", note = "" }) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id");
  if (!p || !WARRANTY_ITEMS.includes(item)) return { ok: false, error: "invalid" };
  const y = String(years).trim() === "" ? null : Number(String(years).replace(",", "."));
  if (y != null && !(y > 0 && y <= 40)) return { ok: false, error: "invalid" };
  const row = {
    company_id: w.co.id, project_id: p.id, item, product: String(product || "").trim().slice(0, 160), years: y,
    starts_on: /^\d{4}-\d{2}-\d{2}$/.test(String(startsOn || "")) ? startsOn : null, note: String(note || "").slice(0, 500), updated_at: new Date().toISOString(),
  };
  const db = supabaseAdmin();
  const { data: cur } = await db.from("warranties").select("id").eq("project_id", p.id).eq("item", item).maybeSingle();
  const { error } = cur ? await db.from("warranties").update(row).eq("id", cur.id) : await db.from("warranties").insert(row);
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  revalidatePath("/service");
  return { ok: true };
}

/** The workspace's Service settings, the owner's to set. */
export async function saveServiceSettings({ replyDays, months, clientReminder }) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  if (!w.isOwner) return { ok: false, error: "owner" };
  const r = Number(replyDays), m = Number(months);
  if (!Number.isInteger(r) || r < 1 || r > 10 || !Number.isInteger(m) || m < 3 || m > 36) return { ok: false, error: "invalid" };
  const { error } = await supabaseAdmin().from("companies").update({ service_reply_days: r, maintenance_months: m, maintenance_client_reminder: !!clientReminder }).eq("id", w.co.id);
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  revalidatePath("/service");
  return { ok: true };
}

/** The client's "report a problem" link for a system. */
export async function serviceLink(projectId) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id, service_token");
  if (!p) return { ok: false, error: "not_found" };
  const token = await ensureServiceToken(supabaseAdmin(), p);
  return token ? { ok: true, path: `/s/${token}` } : { ok: false, error: "needs_db" };
}
