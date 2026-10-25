"use server";
// lib/offerInsights.js — for the installer, in the "link to the client" window of a quote: what the client read on
// the offer (seconds per section, the options looked at; recorded only with OFFER_TRACKING on) and the switch for
// this offer's automatic reminders (proposals.nudges_off). Row security keeps each workspace to its own offers.
import { supabaseServer } from "./supabase.js";

const missing = (e) => !!e && (e.code === "42703" || e.code === "PGRST204" || /column|schema cache/i.test(e.message || ""));

/** @returns {Promise<{code?: string, nudgesOff: boolean, needsDb: boolean, sections: {s: string, seconds: number}[], options: {o: string, n: number}[]} | {error: string}>} */
export async function offerInsights(projectId) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "unauthorized" };
  let { data: prop, error } = await sb.from("proposals").select("code, nudges_off").eq("project_id", String(projectId || "")).order("created_at", { ascending: true }).limit(1).maybeSingle();
  let needsDb = false;
  if (missing(error)) {
    needsDb = true;
    ({ data: prop } = await sb.from("proposals").select("code").eq("project_id", String(projectId || "")).order("created_at", { ascending: true }).limit(1).maybeSingle());
  }
  if (!prop) return { nudgesOff: false, needsDb, sections: [], options: [] };
  const { data: evs } = await sb.from("proposal_events").select("kind, seconds, meta").eq("code", prop.code).in("kind", ["section", "option"]).limit(5000);
  const secs = new Map(), opts = new Map();
  for (const e of evs || []) {
    if (e.kind === "section" && e.meta?.s) secs.set(e.meta.s, (secs.get(e.meta.s) || 0) + (Number(e.seconds) || 0));
    if (e.kind === "option" && e.meta?.o) opts.set(e.meta.o, (opts.get(e.meta.o) || 0) + 1);
  }
  return {
    code: prop.code, nudgesOff: prop.nudges_off === true, needsDb,
    sections: [...secs].map(([s, seconds]) => ({ s, seconds })).sort((a, b) => b.seconds - a.seconds),
    options: [...opts].map(([o, n]) => ({ o, n })).sort((a, b) => b.n - a.n),
  };
}

/** Switch this offer's automatic reminders on or off. @returns {Promise<{ok: boolean, error?: string}>} */
export async function setOfferNudges(projectId, on) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { error } = await sb.from("proposals").update({ nudges_off: !on }).eq("project_id", String(projectId || ""));
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  return { ok: true };
}
