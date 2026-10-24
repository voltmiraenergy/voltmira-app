"use server";
// lib/leadSettings.js — the Settings tab "Estimate page and leads": the installer's public estimate page (its address
// and colour), the weights of the lead score, the districts they serve, and the follow-up days. Read and written here
// on the server, every value checked (lib/publicPage.js, lib/leadScore.js, lib/nudgeTiers.js); only the owner may
// change them. Before add-quote-fast.sql has run, the load says so and the save refuses with "needs_db".
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { currentCompany } from "./session.js";
import { cleanSlug, cleanColor, slugFromName } from "./publicPage.js";
import { cleanWeights } from "./leadScore.js";
import { cleanNudgeDays } from "./nudgeTiers.js";
import { estimatePageOn } from "./offerSwitches.js";
import { RAION } from "./mdRaions.js";
import { revalidatePath } from "next/cache";

const COLS = "public_slug, brand_color, lead_score_weights, service_districts, nudge_days";
const missingColumn = (e) => !!e && (e.code === "42703" || e.code === "PGRST204" || /column|schema cache/i.test(e.message || ""));

async function owner() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const co = await currentCompany();
  if (!user || !co) return null;
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { co, isOwner: me?.role === "owner" };
}

/** What the tab shows. @returns {Promise<object>} */
export async function loadLeadSettings() {
  const who = await owner();
  if (!who) return { error: "unauthorized" };
  const { data, error } = await supabaseAdmin().from("companies").select(COLS).eq("id", who.co.id).maybeSingle();
  const needsDb = missingColumn(error);
  return {
    isOwner: who.isOwner, needsDb, pageOn: estimatePageOn(), companyId: who.co.id,
    slug: data?.public_slug || "", suggested: slugFromName(who.co.short_name || who.co.name),
    color: cleanColor(data?.brand_color), weights: cleanWeights(data?.lead_score_weights),
    districts: Array.isArray(data?.service_districts) ? data.service_districts.filter((d) => RAION[d]) : [],
    nudgeDays: cleanNudgeDays(data?.nudge_days),
  };
}

/**
 * Save the tab. @param {{slug?, color?, weights?, districts?, nudgeDays?}} patch
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function saveLeadSettings(patch) {
  const who = await owner();
  if (!who) return { ok: false, error: "unauthorized" };
  if (!who.isOwner) return { ok: false, error: "owner_only" };
  const row = {};
  if ("slug" in (patch || {})) {
    const raw = String(patch.slug || "").trim();
    const s = cleanSlug(raw);
    if (raw && !s) return { ok: false, error: "bad_slug" };
    row.public_slug = s || null;
  }
  if ("color" in (patch || {})) row.brand_color = cleanColor(patch.color) || null;
  if ("weights" in (patch || {})) row.lead_score_weights = cleanWeights(patch.weights);
  if ("districts" in (patch || {})) row.service_districts = [...new Set((patch.districts || []).filter((d) => RAION[d]))];
  if ("nudgeDays" in (patch || {})) row.nudge_days = cleanNudgeDays(patch.nudgeDays);
  const { error } = await supabaseAdmin().from("companies").update(row).eq("id", who.co.id);
  if (error) {
    if (missingColumn(error)) return { ok: false, error: "needs_db" };
    if (error.code === "23505") return { ok: false, error: "slug_taken" };
    console.error("[lead settings] save failed:", error.message);
    return { ok: false, error: "save_failed" };
  }
  revalidatePath("/leads");
  return { ok: true };
}
