"use server";
// lib/jobActions.js — Phase 3 on the server (docs/features/phase3.md): the jobs board and the crews' week (/jobs),
// crews, visits with the client's email, the on-site record of a won quote (merged with a teammate's changes when a
// phone was offline) and its photos. Reads and writes go through the person's own session, so row security keeps
// each workspace to its own rows; a quote is also checked against access control (a Sales title sees its own).
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { syncMilestones } from "./milestoneServer.js";
import { logActivity } from "./activity.js";
import { currentCompany, currentUser } from "./session.js";
import { projectVisibility } from "./projectAccess.js";
import { mdDayKey, dayKeyOf } from "./tz.js";
import { moveTo, BOARD_COLUMNS } from "./jobBoard.js";
import { cleanVisit, cleanCrew, clashesWith, mondayOf, weekDays } from "./crewVisits.js";
import { cleanRecord, mergeRecord, recordProgress, PHOTO_SLOTS } from "./siteRecord.js";
import { sendVisitEmail } from "./visitMail.js";

const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
const UUID = /^[0-9a-f-]{36}$/i;

async function who() {
  const [user, co] = await Promise.all([currentUser(), currentCompany()]);
  if (!user || !co) return null;
  return { user, co, sb: await supabaseServer(), canSee: await projectVisibility(user, co) };
}

async function myProject(w, projectId, cols = "*") {
  if (!UUID.test(String(projectId || ""))) return null;
  const { data: p } = await w.sb.from("projects").select(cols).eq("id", projectId).maybeSingle();
  return p && p.company_id === w.co.id && w.canSee(p) ? p : null;
}

/** The board and the week: won jobs, crews, the week's visits and the next ones, the on-site progress. */
export async function loadJobs({ monday = null } = {}) {
  const w = await who();
  if (!w) return { error: "unauthorized" };
  const { sb, co } = w;
  const today = mdDayKey(Date.now());
  const mon = /^\d{4}-\d{2}-\d{2}$/.test(String(monday || "")) ? mondayOf(monday) : mondayOf(today);
  const days = weekDays(mon);
  const { data: projs } = await sb.from("projects").select("id, title, client_name, kw, install_progress, status, owner_id, company_id, updated_at, market").eq("status", "won").order("updated_at", { ascending: false }).limit(400);
  const won = (projs || []).filter(w.canSee);
  const ids = won.map((p) => p.id);
  // the day each was won: the client's signature, else its last change
  const { data: props } = ids.length ? await sb.from("proposals").select("project_id, accepted_at").in("project_id", ids).not("accepted_at", "is", null) : { data: [] };
  const signed = new Map();
  for (const p of props || []) if (!signed.has(p.project_id) || signed.get(p.project_id) > p.accepted_at) signed.set(p.project_id, p.accepted_at);
  const { data: crews, error: cErr } = await sb.from("crews").select("*").order("created_at");
  const needsDb = missing(cErr);
  let weekVisits = [], upcoming = [], sites = {};
  if (!needsDb) {
    const start = new Date(Date.parse(days[0] + "T00:00:00Z") - 3 * 3600e3).toISOString();
    const end = new Date(Date.parse(days[6] + "T00:00:00Z") + 27 * 3600e3).toISOString();
    const [{ data: wv }, { data: up }, { data: js }] = await Promise.all([
      sb.from("crew_visits").select("*").gte("starts_at", start).lt("starts_at", end).order("starts_at"),
      sb.from("crew_visits").select("project_id, starts_at, crew_id, kind").gte("starts_at", new Date().toISOString()).order("starts_at").limit(500),
      ids.length ? sb.from("job_site").select("project_id, record").in("project_id", ids) : { data: [] },
    ]);
    weekVisits = (wv || []).filter((v) => days.includes(dayKeyOf(v.starts_at)));
    upcoming = up || [];
    sites = Object.fromEntries((js || []).map((r) => [r.project_id, recordProgress(r.record)]));
  }
  // the jobs a visit may be for: the won ones and the quotes still out (a survey comes before the signature)
  const { data: open } = await sb.from("projects").select("id, title, client_name, owner_id, company_id, status").in("status", ["sent", "won"]).order("updated_at", { ascending: false }).limit(300);
  return {
    needsDb, lang: co.lang || "ro", today, monday: mon, days,
    projects: won.map((p) => ({ id: p.id, title: p.title || "", client_name: p.client_name || "", kw: Number(p.kw) || 0, install_progress: p.install_progress || {}, wonDay: dayKeyOf(signed.get(p.id) || p.updated_at) })),
    crews: crews || [], weekVisits, upcoming, sites,
    visitJobs: (open || []).filter(w.canSee).map((p) => ({ id: p.id, label: p.client_name || p.title || "", status: p.status })),
  };
}

/** Move a job on the board: its install steps follow (lib/jobBoard.js moveTo). */
export async function moveJob(projectId, column) {
  const w = await who();
  if (!w || !BOARD_COLUMNS.includes(column)) return { ok: false, error: "bad_request" };
  const p = await myProject(w, projectId, "id, company_id, owner_id, install_progress, status");
  if (!p || p.status !== "won") return { ok: false, error: "not_found" };
  const prog = moveTo(p.install_progress || {}, column, mdDayKey(Date.now()));
  const { error } = await w.sb.from("projects").update({ install_progress: prog }).eq("id", p.id);
  if (error) return { ok: false, error: "save_failed" };
  revalidatePath(`/projects/${p.id}`);
  // a step reached issues the client's invoice for its stage (lib/milestoneServer.js)
  await syncMilestones(supabaseAdmin(), p.id, { io: { logActivity } });
  return { ok: true, install_progress: prog };
}

/** Add or change a crew. */
export async function saveCrew(input) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const c = cleanCrew(input);
  if (!c.ok) return { ok: false, error: "invalid", fields: c.errors };
  const row = { ...c.row, active: input?.active !== false };
  const q = UUID.test(String(input?.id || ""))
    ? w.sb.from("crews").update(row).eq("id", input.id).select("*").single()
    : w.sb.from("crews").insert({ ...row, company_id: w.co.id }).select("*").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  return { ok: true, crew: data };
}

/**
 * Plan or move a visit. A crew already booked then is said, and saved only when asked again with force. The client
 * is emailed when the visit is new or its time changed, unless the visit's switch is off.
 */
export async function saveVisit(input, { force = false } = {}) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const v = cleanVisit(input);
  if (!v.ok) return { ok: false, error: "invalid", fields: v.errors };
  const project = await myProject(w, v.row.project_id, "id, company_id, owner_id, title, client_name, client_email, status");
  if (!project) return { ok: false, error: "invalid", fields: ["project"] };
  const id = UUID.test(String(input?.id || "")) ? input.id : null;
  const { data: crew } = await w.sb.from("crews").select("id, name").eq("id", v.row.crew_id).maybeSingle();
  if (!crew) return { ok: false, error: "invalid", fields: ["crew"] };
  // the crew's other visits that day (and the night around it), to warn of a double booking
  const from = new Date(Date.parse(v.row.starts_at) - 86_400_000).toISOString(), to = new Date(Date.parse(v.row.ends_at) + 86_400_000).toISOString();
  const { data: near } = await w.sb.from("crew_visits").select("id, crew_id, starts_at, ends_at, project_id").eq("crew_id", crew.id).gte("starts_at", from).lt("starts_at", to);
  const clashes = clashesWith({ ...v.row, id }, near || []);
  if (clashes.length && !force) return { ok: false, error: "clash", clashes };

  let before = null;
  if (id) ({ data: before } = await w.sb.from("crew_visits").select("*").eq("id", id).maybeSingle());
  const row = { ...v.row, updated_at: new Date().toISOString() };
  const q = id
    ? w.sb.from("crew_visits").update(row).eq("id", id).select("*").single()
    : w.sb.from("crew_visits").insert({ ...row, company_id: w.co.id, created_by: w.user.id }).select("*").single();
  const { data: saved, error } = await q;
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };

  // the client hears of a new visit, or of a new time
  const moved = !!before && (before.starts_at !== saved.starts_at || before.ends_at !== saved.ends_at);
  if (saved.notify_client && (!before || moved)) {
    const { data: lang } = await w.sb.from("projects").select("client_lang").eq("id", project.id).maybeSingle();   // add-grid-connection.sql
    const sent = await sendVisitEmail({ co: w.co, project: { ...project, client_lang: lang?.client_lang }, visit: saved, crew, moved, ownerEmail: w.user.email });
    if (sent) {
      const at = new Date().toISOString();
      await w.sb.from("crew_visits").update({ notified_at: at }).eq("id", saved.id);
      saved.notified_at = at;
    }
  }
  return { ok: true, visit: saved, clashes };
}

export async function deleteVisit(id) {
  const w = await who();
  if (!w || !UUID.test(String(id || ""))) return { ok: false, error: "bad_request" };
  const { error } = await w.sb.from("crew_visits").delete().eq("id", id);
  return error ? { ok: false, error: "save_failed" } : { ok: true };
}

/** The on-site record of a won quote, with its photos (links valid for an hour). */
export async function loadSite(projectId) {
  const w = await who();
  if (!w) return { error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id");
  if (!p) return { error: "not_found" };
  const { data, error } = await w.sb.from("job_site").select("record, version, updated_at, updated_by").eq("project_id", p.id).maybeSingle();
  if (missing(error)) return { needsDb: true };
  const { data: photos } = await w.sb.from("job_photos").select("id, slot, path, taken_at, taken_by").eq("project_id", p.id).order("created_at");
  const signed = await signPhotos(w.sb, photos || []);
  return { needsDb: false, record: cleanRecord(data?.record), version: data?.version || 0, updatedBy: data?.updated_by || "", photos: signed };
}

async function signPhotos(sb, photos) {
  if (!photos.length) return [];
  const { data } = await sb.storage.from("job-photos").createSignedUrls(photos.map((x) => x.path), 3600);
  const url = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  return photos.map((x) => ({ id: x.id, slot: x.slot, takenAt: x.taken_at, takenBy: x.taken_by, url: url.get(x.path) || "" }));
}

/**
 * Save the on-site record. `baseVersion` and `base` are what this device started from: when the server moved on
 * meanwhile, the three are merged item by item (lib/siteRecord.js mergeRecord) instead of one overwriting the other.
 * Safe to send twice (the queue does, after no signal).
 */
export async function saveSite(projectId, mine, baseVersion = 0, base = null) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id");
  if (!p) return { ok: false, error: "not_found" };
  const by = String(w.user.user_metadata?.full_name || w.user.email || "").slice(0, 120);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: cur, error } = await w.sb.from("job_site").select("record, version").eq("project_id", p.id).maybeSingle();
    if (missing(error)) return { ok: false, error: "needs_db" };
    const curVersion = cur?.version || 0;
    const merged = curVersion === Number(baseVersion)
      ? { record: cleanRecord(mine), conflicts: [] }
      : mergeRecord(cur?.record, base || cur?.record, mine);
    const next = { record: merged.record, version: curVersion + 1, updated_by: by, updated_at: new Date().toISOString() };
    // written only if nobody wrote since it was read: otherwise read again and merge again
    const r = cur
      ? await w.sb.from("job_site").update(next).eq("project_id", p.id).eq("version", curVersion).select("version")
      : await w.sb.from("job_site").insert({ ...next, project_id: p.id, company_id: w.co.id }).select("version");
    if (r.error && r.error.code !== "23505") return { ok: false, error: "save_failed" };
    if (!r.error && (r.data || []).length) return { ok: true, record: merged.record, version: next.version, conflicts: merged.conflicts };
  }
  return { ok: false, error: "busy" };
}

/**
 * A photo the phone uploaded to the bucket (under <company_id>/<project_id>/): recorded once per device id.
 */
export async function registerPhoto({ projectId, path, slot, clientId, takenAt = null }) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId, "id, company_id, owner_id");
  if (!p) return { ok: false, error: "not_found" };
  const safePath = String(path || "");
  if (!safePath.startsWith(`${w.co.id}/${p.id}/`) || !/^[\w/.-]{20,200}$/.test(safePath)) return { ok: false, error: "bad_path" };
  if (!/^[\w-]{8,64}$/.test(String(clientId || ""))) return { ok: false, error: "bad_id" };
  const row = {
    company_id: w.co.id, project_id: p.id, slot: PHOTO_SLOTS.includes(slot) ? slot : "other", path: safePath, client_id: clientId,
    taken_at: takenAt && !Number.isNaN(Date.parse(takenAt)) ? new Date(takenAt).toISOString() : null,
    taken_by: String(w.user.user_metadata?.full_name || w.user.email || "").slice(0, 120),
  };
  const { error } = await w.sb.from("job_photos").insert(row);
  if (error && error.code !== "23505") return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  return { ok: true };
}

export async function deletePhoto(id) {
  const w = await who();
  if (!w || !UUID.test(String(id || ""))) return { ok: false, error: "bad_request" };
  const { data: ph } = await w.sb.from("job_photos").select("id, path").eq("id", id).maybeSingle();
  if (!ph) return { ok: false, error: "not_found" };
  await w.sb.storage.from("job-photos").remove([ph.path]);
  const { error } = await w.sb.from("job_photos").delete().eq("id", id);
  return error ? { ok: false, error: "save_failed" } : { ok: true };
}
