"use server";
// lib/actions.js — server actions used by the app UI.
import { supabaseServer } from "./supabase.js";
import { currentCompany } from "./session.js";
import { escapeHtml } from "./safe.js";
import { MARKETS } from "@voltmira/engine";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function shortCode(len = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no lookalikes
  let s = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (const b of buf) s += chars[b % chars.length];
  return s;
}

/**
 * Create (or return existing) public proposal link for a project.
 * Freezes a snapshot of the inputs — professional integrity: later edits
 * never change what the client was shown.
 */
export async function createProposal(projectId) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: p, error } = await sb.from("projects").select("*").eq("id", projectId).single();
  if (error || !p) throw new Error("Project not found");

  const { data: existing } = await sb.from("proposals")
    .select("code").eq("project_id", projectId).limit(1).maybeSingle();
  if (existing) return existing.code;

  // The engine settings must be frozen WITH the inputs: recomputing an old
  // proposal with today's settings would silently change what the client was
  // shown, breaking the "frozen snapshot" promise the product is sold on.
  const { data: co } = await sb.from("companies")
    .select("engine, subsidy_amount_ron").eq("id", p.company_id).single();

  const snapshot = {
    title: p.title, client: p.client_name, address: p.address,
    kw: Number(p.kw), price: Number(p.price), cons: Number(p.cons),
    batt: p.batt, battKwh: p.batt_kwh != null ? Number(p.batt_kwh) : 10,
    options: Array.isArray(p.options) ? p.options : [],
    bom: Array.isArray(p.bom) ? p.bom : [],
    // BOM total drives the cost when present; freeze it so the proposal is stable
    costOverride: (Array.isArray(p.bom) ? p.bom : [])
      .reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0), 0),
    market: p.market, useMonthly: p.use_monthly, consMonthly: p.cons_monthly,
    afmSubsidy: p.afm_subsidy, loanMonthly: Number(p.loan_monthly),
    yieldOverride: p.yield_per_kwp ? Number(p.yield_per_kwp) : undefined,
    monthlyYieldShape: p.monthly_yield_shape || undefined,
    engine: { ...(co?.engine || {}), subsidyAmountRon: Number(co?.subsidy_amount_ron ?? 20000) },
  };

  const code = shortCode();
  const { error: e2 } = await sb.from("proposals").insert({
    code, project_id: p.id, company_id: p.company_id, snapshot,
  });
  if (e2) throw new Error(e2.message);

  await sb.from("projects").update({ status: p.status === "draft" ? "sent" : p.status }).eq("id", p.id);
  await sb.from("activity").insert({
    company_id: p.company_id, kind: "quote",
    text: `Proposal link created for <b>${escapeHtml(p.title || "")}</b>`,
  });
  return code;
}

/** Enforce plan limits server-side (never trust the client). */
export async function assertPlanAllows(feature) {
  const sb = supabaseServer();
  const { data: co } = await sb.from("companies").select("plan").single();
  const plan = co?.plan || "free";
  const gates = {
    branded_pdf:   ["pro", "team"],
    saved_catalog: ["pro", "team"],
    team_seats:    ["team"],
  };
  if (gates[feature] && !gates[feature].includes(plan)) {
    throw new Error(`upgrade_required:${feature}`);
  }
  return plan;
}

/** Create a project with company defaults; returns its id. */
export async function createProject() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  // Reads `companies` (RLS via the security-definer my_company_id(), no
  // recursion) and self-heals a missing workspace via bootstrap. We deliberately
  // do NOT read `profiles` here — that table's RLS recurses; the company row
  // already carries everything New quote needs.
  const co = await currentCompany();
  if (!co) redirect("/login");
  const market = co.default_market || "MD";
  const { data, error } = await sb.from("projects").insert({
    company_id: co.id, owner_id: user.id,
    market,
    // pre-fill the electricity price with this market's regional default
    price: (MARKETS[market] || MARKETS.MD).defaultPrice,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await sb.from("activity").insert({
    company_id: co.id, kind: "quote", text: "New quote created",
  });
  return data.id;
}

/** Save company settings. Routed through here (service role, scoped to the
 *  caller's OWN company) because the companies_update RLS policy contains a
 *  profiles subquery that recurses — a direct client update currently errors. */
export async function saveCompany(patch) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");

  const A = (await import("./supabase.js")).supabaseAdmin();
  // Allow-list the writable columns; never let the client set arbitrary fields.
  const allowed = ["name", "short_name", "logo_url", "default_market", "currency",
    "lang", "subsidy_amount_ron", "prosumer_limit_kw", "notify_open", "engine"];
  const clean = {};
  for (const k of allowed) if (k in (patch || {})) clean[k] = patch[k];

  const { error } = await A.from("companies").update(clean).eq("id", co.id);
  if (error) throw new Error(error.message);
  // Company identity (name, logo) and especially `lang` are read by the shared
  // (app) layout — the sidebar nav — and by every tab's server render. Bust the
  // whole app tree so a language change takes effect across the ENTIRE interface,
  // not just the Settings page. The client also calls router.refresh() to clear
  // its Router Cache for already-visited tabs.
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------- product catalog ---------------- */
const PRODUCT_KINDS = ["panel", "inverter", "battery", "mounting", "other"];

// Only allow an https image URL (or empty) — never javascript:/data: in a stored
// field that gets rendered as an <img src>. Length-capped.
function cleanImageUrl(u) {
  const s = String(u || "").trim().slice(0, 500);
  return /^https:\/\//i.test(s) ? s : "";
}

// Core fields that have always existed — safe to write even before the
// add-product-image.sql migration has run.
function cleanProduct(patch) {
  return {
    kind: PRODUCT_KINDS.includes(patch?.kind) ? patch.kind : "panel",
    brand: String(patch?.brand || "").slice(0, 80),
    model: String(patch?.model || "").slice(0, 80),
    spec: String(patch?.spec || "").slice(0, 60),
    unit_price: Math.max(0, Number(patch?.unit_price) || 0),
  };
}
function productWithImage(patch) {
  return { ...cleanProduct(patch), image_url: cleanImageUrl(patch?.image_url) };
}
// True when a write failed only because the image_url column isn't there yet, so
// the caller can retry with the core fields and degrade gracefully.
const missingImageCol = (e) => e && /image_url/i.test(e.message || "");

// A curated starter catalog of real equipment RO/MD installers actually quote,
// with representative EUR unit prices (editable) and real product photos where a
// good one exists (others fall back to a kind icon in the UI). Loaded on demand
// from the Catalog tab so a new installer isn't staring at an empty library.
const IMG = {
  panelGround: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=400&q=70",
  panelRoof:   "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=400&q=70",
  panelAerial: "https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=400&q=70",
  battery:     "https://commons.wikimedia.org/wiki/Special:FilePath/Tesla%20Powerwall%202.jpg?width=400",
  mounting:    "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?auto=format&fit=crop&w=400&q=70",
};
const STARTER_CATALOG = [
  { kind: "panel",    brand: "Jinko Solar",    model: "Tiger Neo N-type 60HL4", spec: "440 W",  unit_price: 82,   image_url: IMG.panelGround },
  { kind: "panel",    brand: "LONGi",          model: "Hi-MO 6 Explorer",       spec: "435 W",  unit_price: 85,   image_url: IMG.panelRoof },
  { kind: "panel",    brand: "Canadian Solar", model: "TOPHiKu6",               spec: "450 W",  unit_price: 88,   image_url: IMG.panelAerial },
  { kind: "inverter", brand: "Huawei",         model: "SUN2000-8KTL-M1",        spec: "8 kW hybrid",  unit_price: 1180, image_url: "" },
  { kind: "inverter", brand: "Deye",           model: "SUN-6K-SG04LP3",         spec: "6 kW hybrid",  unit_price: 980,  image_url: "" },
  { kind: "inverter", brand: "Fronius",        model: "Symo GEN24 10.0 Plus",   spec: "10 kW hybrid", unit_price: 1890, image_url: "" },
  { kind: "battery",  brand: "Tesla",          model: "Powerwall 2",            spec: "13.5 kWh", unit_price: 6900, image_url: IMG.battery },
  { kind: "battery",  brand: "Pylontech",      model: "US5000",                 spec: "4.8 kWh",  unit_price: 1480, image_url: "" },
  { kind: "battery",  brand: "Huawei",         model: "LUNA2000-5-S0",          spec: "5 kWh",    unit_price: 2150, image_url: "" },
  { kind: "mounting", brand: "K2 Systems",     model: "SingleRail set (per panel)", spec: "rail + clamps", unit_price: 42, image_url: IMG.mounting },
  { kind: "mounting", brand: "Renusol",        model: "VarioSole+ end clamp set",   spec: "per panel",     unit_price: 9,  image_url: "" },
  { kind: "other",    brand: "Generic",        model: "DC cable + MC4 connectors",  spec: "per string",    unit_price: 35, image_url: "" },
];

/** Load the starter catalog into the company's library (one click from the
 *  Catalog tab). Returns the inserted rows so the UI can render them without a
 *  refetch. RLS scopes every row to the caller's own company. */
export async function seedStarterCatalog() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");
  const withImg = STARTER_CATALOG.map(p => ({ company_id: co.id, ...productWithImage(p) }));
  let { data, error } = await sb.from("products").insert(withImg).select("*");
  if (missingImageCol(error)) {  // pre-migration: seed without photos
    ({ data, error } = await sb.from("products")
      .insert(STARTER_CATALOG.map(p => ({ company_id: co.id, ...cleanProduct(p) }))).select("*"));
  }
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
  return data || [];
}

/** Add a product to the company's catalog. Returns the inserted row (with id)
 *  so the UI can append it without a refetch. RLS scopes to own company. */
export async function addProduct(patch) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");
  let { data, error } = await sb.from("products")
    .insert({ company_id: co.id, ...productWithImage(patch) }).select("*").single();
  if (missingImageCol(error)) {  // pre-migration: save without the photo
    ({ data, error } = await sb.from("products")
      .insert({ company_id: co.id, ...cleanProduct(patch) }).select("*").single());
  }
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
  return data;
}

/** Edit a catalog product. RLS scopes to own company. */
export async function updateProduct(id, patch) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  let { error } = await sb.from("products").update(productWithImage(patch)).eq("id", id);
  if (missingImageCol(error)) {  // pre-migration: save without the photo
    ({ error } = await sb.from("products").update(cleanProduct(patch)).eq("id", id));
  }
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
}

/** Remove a catalog product. RLS scopes to own company. */
export async function deleteProduct(id) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  await sb.from("products").delete().eq("id", id);
  revalidatePath("/catalog");
}

/** Dismiss a "needs follow-up" reminder on the dashboard. Snoozes it for a week
 *  (it re-surfaces if the quote is still cold) so reminders don't pile up forever.
 *  RLS scopes to own company; best-effort if the column isn't there yet. */
export async function snoozeFollowUp(projectId) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  await sb.from("projects").update({ followup_snoozed_at: new Date().toISOString() }).eq("id", projectId);
  revalidatePath("/dashboard");
}

/** Delete a project (RLS scopes to own company). */
export async function deleteProject(id) {
  const sb = supabaseServer();
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Triage a lead: new → contacted → converted → archived. RLS scopes the write
 *  to the caller's company. Swallows the error if the `status` column isn't
 *  there yet (migration add-leads-status.sql), so the tab works before it runs. */
export async function setLeadStatus(id, status) {
  if (!["new", "contacted", "converted", "archived"].includes(status)) return;
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  await sb.from("leads").update({ status }).eq("id", id);
  revalidatePath("/leads");
}

/** Toggle a post-sale installation step for a project. Stores a map of
 *  step-key -> ISO date (or removes the key when unchecked). RLS scopes to the
 *  caller's company. Best-effort: no-op if the install_progress column is absent. */
export async function setInstallStep(projectId, step, done) {
  const allowed = ["deposit", "permit", "order", "install", "grid", "commission"];
  if (!allowed.includes(step)) return;
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: proj } = await sb.from("projects").select("install_progress").eq("id", projectId).single();
  const prog = { ...(proj?.install_progress || {}) };
  if (done) prog[step] = new Date().toISOString().slice(0, 10);
  else delete prog[step];
  await sb.from("projects").update({ install_progress: prog }).eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
}

/** Edit a lead's contact details (name / email / phone). RLS scopes the write to
 *  the caller's own company. Length-clamped; empty strings are allowed (clearing). */
export async function updateLead(id, patch) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const clean = {
    name:  String(patch?.name  || "").slice(0, 120),
    email: String(patch?.email || "").slice(0, 160),
    phone: String(patch?.phone || "").slice(0, 40),
  };
  await sb.from("leads").update(clean).eq("id", id);
  revalidatePath("/leads");
}

/** Tag a lead's marketing channel (website / facebook / … ) for attribution.
 *  Best-effort: no-op if the `channel` column isn't there yet (degrades to the
 *  auto-derived source in the UI until the migration runs). */
export async function setLeadChannel(id, channel) {
  const allowed = ["website", "facebook", "instagram", "whatsapp", "google", "referral", "coldcall", "other"];
  if (!allowed.includes(channel)) return;
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  await sb.from("leads").update({ channel }).eq("id", id);
  revalidatePath("/leads");
}

/** Delete a lead outright (RLS scopes to own company). */
export async function deleteLead(id) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  await sb.from("leads").delete().eq("id", id);
  revalidatePath("/leads");
}

/** Turn a lead into a quote: create a project pre-filled with the lead's name,
 *  link them, mark the lead converted, and return the new project id so the UI
 *  can open the editor. The whole funnel loop in one click. */
export async function createProjectFromLead(id) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) redirect("/login");
  const { data: lead } = await sb.from("leads").select("*").eq("id", id).single();
  const market = co.default_market || "MD";
  const { data, error } = await sb.from("projects").insert({
    company_id: co.id, owner_id: user.id, market,
    price: (MARKETS[market] || MARKETS.MD).defaultPrice,
    client_name: (lead?.name || "").slice(0, 120),
    title: lead?.name ? lead.name : "New quote",
  }).select("id").single();
  if (error) throw new Error(error.message);
  // Link the lead to its project (always) and mark it converted (no-op if the
  // status column isn't there yet — two writes so project_id still lands).
  await sb.from("leads").update({ project_id: data.id }).eq("id", id);
  await sb.from("leads").update({ status: "converted" }).eq("id", id);
  await sb.from("activity").insert({ company_id: co.id, kind: "quote", text: "Quote created from a lead" });
  revalidatePath("/leads"); revalidatePath("/projects");
  return data.id;
}

/** Save the current quote's core inputs as a reusable template (max 20).
 *  Stored on companies.quote_templates (JSONB); scoped to the caller's company. */
export async function saveQuoteTemplate(tpl) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");
  const list = Array.isArray(co.quote_templates) ? co.quote_templates.slice() : [];
  list.push({
    id: shortCode(6),
    name: (String(tpl?.name || "Template")).slice(0, 40),
    kw: Number(tpl?.kw) || 6,
    market: ["RO", "MD", "DE"].includes(tpl?.market) ? tpl.market : "RO",
    batt: !!tpl?.batt,
    price: Number(tpl?.price) || 0.21,
    cons: Number(tpl?.cons) || 5000,
  });
  const A = (await import("./supabase.js")).supabaseAdmin();
  const { error } = await A.from("companies").update({ quote_templates: list.slice(-20) }).eq("id", co.id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");   // so the new template shows up on the Projects page immediately
  return { ok: true };
}

/** Remove a saved template by id. */
export async function deleteQuoteTemplate(id) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) return;
  const list = (Array.isArray(co.quote_templates) ? co.quote_templates : []).filter(t => t.id !== id);
  const A = (await import("./supabase.js")).supabaseAdmin();
  await A.from("companies").update({ quote_templates: list }).eq("id", co.id);
  revalidatePath("/projects");
}

/** New quote pre-filled from a saved template (or blank if not found). */
export async function createProjectFromTemplate(templateId) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) redirect("/login");
  const tpl = (co.quote_templates || []).find(t => t.id === templateId);
  const market = (tpl?.market) || co.default_market || "MD";
  const { data, error } = await sb.from("projects").insert({
    company_id: co.id, owner_id: user.id, market,
    kw: tpl?.kw ?? 6,
    price: tpl?.price ?? (MARKETS[market] || MARKETS.MD).defaultPrice,
    cons: tpl?.cons ?? 5000,
    batt: tpl?.batt ?? false,
    title: tpl?.name || "New quote",
  }).select("id").single();
  if (error) throw new Error(error.message);
  await sb.from("activity").insert({ company_id: co.id, kind: "quote", text: "New quote created" });
  revalidatePath("/projects");
  return data.id;
}

/** Bulk status change (or delete) for many projects at once — end-of-month
 *  pipeline cleanup. RLS scopes every write to the caller's company. */
export async function bulkUpdateStatus(ids, op) {
  const sb = supabaseServer();
  const clean = (Array.isArray(ids) ? ids : []).filter(Boolean).slice(0, 200);
  if (!clean.length) return;
  if (op === "delete") {
    await sb.from("projects").delete().in("id", clean);
    return;
  }
  if (["draft", "sent", "won", "lost"].includes(op)) {
    await sb.from("projects").update({ status: op }).in("id", clean);
  }
}

/** Duplicate a project (demo's row "duplicate" action). Copies every quote
 *  input into a fresh draft titled "… (copy)". RLS scopes read + write. */
export async function duplicateProject(id) {
  const sb = supabaseServer();
  const { data: p } = await sb.from("projects").select("*").eq("id", id).single();
  if (!p) return null;
  const { id: _id, created_at, updated_at, ...rest } = p;
  const { data, error } = await sb.from("projects").insert({
    ...rest,
    title: (p.title || "Untitled") + " (copy)",
    status: "draft",
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** One-click "Mark won" from a table row. Idempotent; logs activity on the
 *  first transition. RLS scopes read + write to the caller's company. */
export async function markProjectWon(id) {
  const sb = supabaseServer();
  const { data: p } = await sb.from("projects").select("status, title, company_id").eq("id", id).single();
  if (!p || p.status === "won") return;
  const { error } = await sb.from("projects").update({ status: "won" }).eq("id", id);
  if (error) throw new Error(error.message);
  await sb.from("activity").insert({
    company_id: p.company_id, kind: "won",
    text: `Marked <b>${escapeHtml(p.title || "")}</b> as won`,
  });
}

/** Cycle a project's status draft→sent→won→lost→draft (demo chip behaviour).
 *  RLS scopes both the read and the write to the caller's company. */
const STATUS_CYCLE = { draft: "sent", sent: "won", won: "lost", lost: "draft" };
export async function cycleProjectStatus(id) {
  const sb = supabaseServer();
  const { data: p } = await sb.from("projects").select("status").eq("id", id).single();
  if (!p) return;
  const next = STATUS_CYCLE[p.status] || "draft";
  const { error } = await sb.from("projects").update({ status: next }).eq("id", id);
  if (error) throw new Error(error.message);
}
