"use server";
// lib/actions.js — server actions used by the app UI.
import { supabaseServer } from "./supabase.js";
import { currentCompany, currentActor } from "./session.js";
import { escapeHtml } from "./safe.js";
import { logActivity } from "./activity.js";
import { MARKETS } from "@voltmira/engine";
import { getFxRates } from "./fx.js";
import { mdDayKey } from "./tz.js";
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
/** Today's FX, or undefined so the engine falls back to its static table.
 *  Never throws: a proposal must be creatable with the exchange market down. */
async function currentFx() {
  try { return (await getFxRates()).rates; } catch { return undefined; }
}

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
    // The quote price follows the system size, not the BOM (the BOM is the
    // installer's equipment cost / margin, not the client price), so proposals
    // are never overridden by the materials total. Kept for shape stability.
    costOverride: 0,
    market: p.market, useMonthly: p.use_monthly, consMonthly: p.cons_monthly,
    afmSubsidy: p.afm_subsidy, loanMonthly: Number(p.loan_monthly),
    yieldOverride: p.yield_per_kwp ? Number(p.yield_per_kwp) : undefined,
    monthlyYieldShape: p.monthly_yield_shape || undefined,
    // Freeze the FX rate alongside the settings. Grants are stored in local
    // currency and converted to EUR, so without this a rate move would silently
    // re-price a proposal the client had already been shown — exactly what the
    // frozen snapshot exists to prevent.
    engine: {
      ...(co?.engine || {}),
      subsidyAmountRon: Number(co?.subsidy_amount_ron ?? 20000),
      fx: await currentFx(),
    },
  };

  const code = shortCode();
  const { error: e2 } = await sb.from("proposals").insert({
    code, project_id: p.id, company_id: p.company_id, snapshot,
  });
  if (e2) throw new Error(e2.message);

  // Checked: if this silently failed the quote stayed "draft" while a live
  // proposal link existed, so the pipeline KPI and the follow-up strip both
  // ignored a quote the client could already read.
  const { error: stErr } = await sb.from("projects")
    .update({ status: p.status === "draft" ? "sent" : p.status }).eq("id", p.id);
  if (stErr) console.error("[createProposal] status update failed:", stErr.message);
  await logActivity(sb, {
    companyId: p.company_id, kind: "quote", key: "act_proposal_created",
    params: { b: p.title || "" },
    text: `Proposal link created for <b>${escapeHtml(p.title || "")}</b>`,
    actor: await currentActor(), link: `/projects/${p.id}`,
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
  await logActivity(sb, { companyId: co.id, kind: "quote", key: "act_quote_created", text: "New quote created", actor: await currentActor(), link: `/projects/${data.id}` });
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
    "lang", "subsidy_amount_ron", "prosumer_limit_kw", "notify_open", "engine",
    // company legal details for invoicing (see add-company-invoicing.sql)
    "legal_name", "reg_no", "vat_no", "legal_address", "iban", "invoice_prefix", "vat_rate"];
  const INVOICE_COLS = ["legal_name", "reg_no", "vat_no", "legal_address", "iban", "invoice_prefix", "vat_rate"];
  const clean = {};
  for (const k of allowed) if (k in (patch || {})) clean[k] = patch[k];

  // RBAC: the calculation engine, subsidies and prosumer limit are the "hard
  // costs" — OWNER-ONLY. A Sales/Engineer/Manager can still save company identity,
  // but these financial fields are dropped server-side even if the UI is bypassed.
  const { data: me } = await A.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isOwner = me?.role !== "member";   // no profile row = the original owner
  if (!isOwner) { delete clean.engine; delete clean.subsidy_amount_ron; delete clean.prosumer_limit_kw; }

  // Clamp the calculation inputs. The allowed-key filter above stopped unknown
  // COLUMNS, but nothing checked the VALUES — costPerKw 0 or horizon 0 saved
  // happily and produced quotes with a zero-cost system or an empty cash-flow
  // series. Bounds are generous; they only exclude the physically meaningless.
  if (clean.engine && typeof clean.engine === "object") {
    const B = {
      costPerKw:         [200, 5000],
      batteryCost:       [0, 100000],
      batteryCostPerKwh: [0, 5000],
      baseYield:         [400, 2500],
      opexPct:           [0, 10],
      horizon:           [5, 40],
      subsidyAmountMdl:  [0, 10000000],
      quoteValidityDays: [1, 365],
    };
    const e = { ...clean.engine };
    for (const [k, [lo, hi]] of Object.entries(B)) {
      if (k in e) {
        const n = Number(e[k]);
        // A non-numeric value means "leave it alone" — dropping the key lets
        // the engine default apply rather than writing NaN into the settings.
        if (!Number.isFinite(n)) delete e[k];
        else e[k] = Math.min(hi, Math.max(lo, n));
      }
    }
    clean.engine = e;
  }
  if ("subsidy_amount_ron" in clean) {
    const n = Number(clean.subsidy_amount_ron);
    clean.subsidy_amount_ron = Number.isFinite(n) ? Math.min(1000000, Math.max(0, n)) : 0;
  }
  if ("prosumer_limit_kw" in clean) {
    const n = Number(clean.prosumer_limit_kw);
    clean.prosumer_limit_kw = Number.isFinite(n) ? Math.min(1000, Math.max(0, n)) : 0;
  }

  let { error } = await A.from("companies").update(clean).eq("id", co.id);
  // Graceful before add-company-invoicing.sql runs: if the invoice columns are
  // missing, drop them and retry so the rest of Settings still saves.
  if (error && /(column|schema cache|legal_name|reg_no|vat_no|legal_address|iban|invoice_prefix|vat_rate)/i.test(error.message || "")) {
    const core = { ...clean };
    for (const k of INVOICE_COLS) delete core[k];
    ({ error } = await A.from("companies").update(core).eq("id", co.id));
  }
  if (error) throw new Error(error.message);

  // Blame-shield: log exactly which hard-cost settings changed (old → new), so
  // the owner can see who altered the numbers instead of blaming the software.
  const num = (v) => Math.round(Number(v) || 0).toLocaleString("en-IE");
  const changes = [];
  if ("subsidy_amount_ron" in clean && +clean.subsidy_amount_ron !== +(co.subsidy_amount_ron || 0)) changes.push(`AFM subsidy ${num(co.subsidy_amount_ron)}→${num(clean.subsidy_amount_ron)} RON`);
  if ("prosumer_limit_kw" in clean && +clean.prosumer_limit_kw !== +(co.prosumer_limit_kw || 0)) changes.push(`prosumer limit ${num(co.prosumer_limit_kw)}→${num(clean.prosumer_limit_kw)} kW`);
  if ("engine" in clean) {
    const oe = co.engine || {}, ne = clean.engine || {};
    const F = [["costPerKw", "cost/kW €"], ["batteryCostPerKwh", "battery €/kWh"], ["baseYield", "yield kWh/kWp"], ["opexPct", "O&M %"], ["horizon", "horizon yr"], ["subsidyAmountMdl", "MD grant MDL"], ["quoteValidityDays", "validity days"]];
    for (const [k, label] of F) if (k in ne && +(ne[k] ?? 0) !== +(oe[k] ?? 0)) changes.push(`${label} ${num(oe[k])}→${num(ne[k])}`);
  }
  if (changes.length) {
    const summary = changes.slice(0, 4).join(", ") + (changes.length > 4 ? "…" : "");
    await logActivity(A, { companyId: co.id, kind: "sys", key: "act_settings_changed", params: { b: summary }, text: `Updated settings — <b>${escapeHtml(summary)}</b>`, actor: await currentActor(), link: "/settings" });
  }

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
// Full write incl. inventory (add-product-stock.sql). `track_stock` is the toggle;
// `stock` is physical units on hand (non-negative integer).
function productFull(patch) {
  return {
    ...productWithImage(patch),
    track_stock: !!patch?.track_stock,
    stock: Math.max(0, Math.round(Number(patch?.stock) || 0)),
  };
}
// True when a write failed only because the image_url column isn't there yet, so
// the caller can retry with the core fields and degrade gracefully.
const missingImageCol = (e) => e && /image_url/i.test(e.message || "");
// True when the inventory columns aren't there yet (add-product-stock.sql not run).
const missingStockCol = (e) => e && /stock/i.test(e.message || "");

// A curated starter catalog of real equipment RO/MD installers actually quote,
// with representative EUR unit prices (editable) and real product photos where a
// good one exists (others fall back to a kind icon in the UI). Loaded on demand
// from the Catalog tab so a new installer isn't staring at an empty library.
// Every starter product ships with a real, verified product photo (Unsplash /
// Wikimedia Commons, https). The installer swaps them for their own later.
const IMG = {
  panelGround:  "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=400&q=70",
  panelRoof:    "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=400&q=70",
  panelAerial:  "https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=400&q=70",
  inverterA:    "https://upload.wikimedia.org/wikipedia/commons/1/1c/SolarEdge-Inverter.jpg",
  inverterB:    "https://upload.wikimedia.org/wikipedia/commons/6/68/Onduleur_pour_photovolta%C3%AFque.jpg",
  inverterC:    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Inverter_Fronius_%3D_Sunways_NT_6000-01ASD.jpg/500px-Inverter_Fronius_%3D_Sunways_NT_6000-01ASD.jpg",
  batteryTesla: "https://commons.wikimedia.org/wiki/Special:FilePath/Tesla%20Powerwall%202.jpg?width=400",
  batteryStack: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Household_battery_storage.png/500px-Household_battery_storage.png",
  batteryHome:  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Household_solar_energy_storage_system.jpg/500px-Household_solar_energy_storage_system.jpg",
  mountingRoof: "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?auto=format&fit=crop&w=400&q=70",
  mountingGnd:  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Photovoltaic_mounting_system.jpg/500px-Photovoltaic_mounting_system.jpg",
  cableMc4:     "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/MC4_Connector_Front_and_Top_View.jpg/500px-MC4_Connector_Front_and_Top_View.jpg",
};
const STARTER_CATALOG = [
  { kind: "panel",    brand: "Jinko Solar",    model: "Tiger Neo N-type 60HL4", spec: "440 W",  unit_price: 82,   image_url: IMG.panelGround },
  { kind: "panel",    brand: "LONGi",          model: "Hi-MO 6 Explorer",       spec: "435 W",  unit_price: 85,   image_url: IMG.panelRoof },
  { kind: "panel",    brand: "Canadian Solar", model: "TOPHiKu6",               spec: "450 W",  unit_price: 88,   image_url: IMG.panelAerial },
  { kind: "inverter", brand: "Huawei",         model: "SUN2000-8KTL-M1",        spec: "8 kW hybrid",  unit_price: 1180, image_url: IMG.inverterA },
  { kind: "inverter", brand: "Deye",           model: "SUN-6K-SG04LP3",         spec: "6 kW hybrid",  unit_price: 980,  image_url: IMG.inverterB },
  { kind: "inverter", brand: "Fronius",        model: "Symo GEN24 10.0 Plus",   spec: "10 kW hybrid", unit_price: 1890, image_url: IMG.inverterC },
  { kind: "battery",  brand: "Tesla",          model: "Powerwall 2",            spec: "13.5 kWh", unit_price: 6900, image_url: IMG.batteryTesla },
  { kind: "battery",  brand: "Pylontech",      model: "US5000",                 spec: "4.8 kWh",  unit_price: 1480, image_url: IMG.batteryStack },
  { kind: "battery",  brand: "Huawei",         model: "LUNA2000-5-S0",          spec: "5 kWh",    unit_price: 2150, image_url: IMG.batteryHome },
  { kind: "mounting", brand: "K2 Systems",     model: "SingleRail set (per panel)", spec: "rail + clamps", unit_price: 42, image_url: IMG.mountingRoof },
  { kind: "mounting", brand: "Renusol",        model: "VarioSole+ end clamp set",   spec: "per panel",     unit_price: 9,  image_url: IMG.mountingGnd },
  { kind: "other",    brand: "Generic",        model: "DC cable + MC4 connectors",  spec: "per string",    unit_price: 35, image_url: IMG.cableMc4 },
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

/** The caller's role — "owner" or "member". No profile row = the original owner
 *  (self-heal). Used to gate owner-only settings in the UI (server enforces too). */
export async function getMyRole() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return "member";
  const A = (await import("./supabase.js")).supabaseAdmin();
  const { data } = await A.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "member" ? "member" : "owner";
}

/* ---------------- individual user profile ---------------- */
// Personal details for the logged-in user (their own profile row only). Uses the
// service role scoped to the verified auth id because the profiles RLS policy
// recurses on a user-session read. Never lets a user change their own role.
export async function saveProfile(patch) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");
  const A = (await import("./supabase.js")).supabaseAdmin();
  const okTitle = ["sales", "engineer", "manager"];
  const fields = {
    name: String(patch?.name || "").slice(0, 120),
    phone: String(patch?.phone || "").slice(0, 40),
    avatar_url: cleanImageUrl(patch?.avatar_url) || (/^data:image\//i.test(patch?.avatar_url || "") ? String(patch.avatar_url).slice(0, 300000) : ""),
  };
  if (okTitle.includes(patch?.title)) fields.title = patch.title;

  // Google-OAuth users can be profile-less (only email signup runs bootstrap), so
  // an UPDATE would silently touch 0 rows. Create the row if it's missing — this
  // user owns their own workspace. Retry without the newer columns if the
  // add-profile-fields migration hasn't run yet (name still persists).
  const { data: existing } = await A.from("profiles").select("id").eq("id", user.id).maybeSingle();
  let error;
  if (existing) {
    ({ error } = await A.from("profiles").update(fields).eq("id", user.id));
    if (error && /(phone|avatar_url|title|column|schema cache)/i.test(error.message || "")) {
      ({ error } = await A.from("profiles").update({ name: fields.name }).eq("id", user.id));
    }
  } else {
    const base = { id: user.id, company_id: co.id, email: user.email || "", role: "owner", name: fields.name };
    ({ error } = await A.from("profiles").insert({ ...base, ...fields }));
    if (error && /(phone|avatar_url|title|column|schema cache)/i.test(error.message || "")) {
      ({ error } = await A.from("profiles").insert(base));
    }
  }
  if (error) throw new Error(error.message);
  revalidatePath("/profile"); revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------- demo / sample data ---------------- */
const missingSampleCol = (e) => e && /sample/i.test(e.message || "");
const dropSample = (rows) => rows.map(({ sample, ...r }) => r);

// The activity table has no `sample` column, so we identify seeded feed rows by
// their exact text and remove them by that on clear (also cleans up leftovers
// from before this fix). Keep these texts identical in seed + clear.
const SAMPLE_ACTIVITY = [
  { kind: "won",  key: "act_won",         params: { b: "Casa Rusu — Chișinău" }, text: "Marked <b>Casa Rusu — Chișinău</b> as won" },
  { kind: "lead", key: "act_opened_hot",  params: { b: "Ion Popescu", title: "Vila Popescu — Iași", n: 4 }, text: "<b>Ion Popescu</b> opened “Vila Popescu — Iași” again — 4× total. Worth a call now." },
  { kind: "lead", key: "act_lead_widget", params: { b: "Natalia Cazacu" }, text: "New lead from the website widget: <b>Natalia Cazacu</b>" },
];

/** Fill the workspace with a realistic sample pipeline so a live demo never
 *  shows an empty dashboard. Everything is flagged `sample:true` so it can be
 *  removed in one click. Degrades gracefully if the sample column isn't there
 *  yet (the rows just can't be auto-cleared until the migration runs). */
export async function seedSampleData() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");
  const now = Date.now();
  const ago = (d) => new Date(now - d * 86400000).toISOString();

  const P = [
    { title: "Casa Rusu — Chișinău",     client_name: "Andrei Rusu",     market: "MD", kw: 8,  price: 0.18, cons: 6000,  batt: true,  status: "won",   updated_at: ago(6),  created_at: ago(40) },
    { title: "Vila Popescu — Iași",      client_name: "Ion Popescu",     market: "RO", kw: 6,  price: 0.21, cons: 4800,  batt: false, status: "sent",  updated_at: ago(5),  created_at: ago(12) },
    { title: "Pensiune Verde — Bălți",   client_name: "Maria Ciobanu",   market: "MD", kw: 12, price: 0.18, cons: 9000,  batt: true,  status: "sent",  updated_at: ago(17), created_at: ago(26) },
    { title: "Casă Munteanu — Cluj",     client_name: "Vlad Munteanu",   market: "RO", kw: 5,  price: 0.21, cons: 4000,  batt: false, status: "won",   updated_at: ago(38), created_at: ago(62) },
    { title: "Fermă Solar — Orhei",      client_name: "Petru Lungu",     market: "MD", kw: 20, price: 0.18, cons: 15000, batt: false, status: "draft", updated_at: ago(2),  created_at: ago(3) },
    { title: "Casa Rotaru — Chișinău",   client_name: "Elena Rotaru",    market: "MD", kw: 7,  price: 0.18, cons: 5500,  batt: false, status: "lost",  updated_at: ago(72), created_at: ago(88) },
  ];
  const projRows = P.map(p => ({ company_id: co.id, owner_id: user.id, sample: true, ...p }));
  let pins = await sb.from("projects").insert(projRows).select("*");
  if (missingSampleCol(pins.error)) pins = await sb.from("projects").insert(dropSample(projRows)).select("*");
  if (pins.error) throw new Error(pins.error.message);
  const projects = pins.data || [];

  // One sent quote gets a tracked proposal that's already been opened — lights up
  // the Opens column, the funnel, and the "Today" strip.
  const hot = projects.find(p => p.title.startsWith("Vila Popescu"));
  if (hot) {
    const snapshot = {
      title: hot.title, client: hot.client_name, address: "", kw: +hot.kw, price: +hot.price, cons: +hot.cons,
      batt: hot.batt, battKwh: 10, options: [], bom: [], costOverride: 0, market: hot.market,
      useMonthly: false, consMonthly: null, afmSubsidy: false, loanMonthly: 118,
      engine: { ...(co.engine || {}), subsidyAmountRon: Number(co.subsidy_amount_ron ?? 20000) },
    };
    await sb.from("proposals").insert({
      code: shortCode(), project_id: hot.id, company_id: co.id, snapshot,
      opens: 4, seconds: 214, last_open: ago(1), created_at: ago(5),
    });
  }

  const L = [
    { name: "Grigore Cebotari", phone: "+373 691 22 145", email: "",                          channel: "whatsapp", status: "new",       hot: true,  note: "Wants 6 kW + battery — messaged on WhatsApp." },
    { name: "Natalia Cazacu",   phone: "",                email: "natalia.cazacu@gmail.com",  channel: "facebook", status: "new",       hot: false, note: "Filled the website form — 120 m² roof in Chișinău." },
    { name: "Sergiu Vasilache", phone: "+373 601 90 322", email: "",                          channel: "referral", status: "contacted", hot: false, note: "Referred by a neighbour in Bălți." },
    { name: "Dumitru Sîrbu",    phone: "+373 678 41 208", email: "",                          channel: "coldcall", status: "new",       hot: false, note: "Cold call — interested for spring." },
  ];
  const leadRows = L.map((l, i) => ({ company_id: co.id, source: "manual", sample: true, created_at: ago(i + 1), ...l }));
  let lins = await sb.from("leads").insert(leadRows);
  if (missingSampleCol(lins.error)) await sb.from("leads").insert(dropSample(leadRows));

  // A few feed entries so the activity feed reads as a real, active workspace.
  for (const a of SAMPLE_ACTIVITY) await logActivity(sb, { companyId: co.id, ...a });

  revalidatePath("/dashboard"); revalidatePath("/projects"); revalidatePath("/leads");
  return { ok: true };
}

/** Remove everything seedSampleData() added (proposals cascade with the project).
 *  Scoped to the caller's company via RLS; a no-op if the sample column is absent. */
export async function clearSampleData() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");
  await sb.from("projects").delete().eq("company_id", co.id).eq("sample", true);
  await sb.from("leads").delete().eq("company_id", co.id).eq("sample", true);
  // Remove the seeded feed entries too (they have no sample column — match by text).
  await sb.from("activity").delete().eq("company_id", co.id).in("text", SAMPLE_ACTIVITY.map(a => a.text));
  revalidatePath("/dashboard"); revalidatePath("/projects"); revalidatePath("/leads");
  return { ok: true };
}

/* ---------------- referral program ---------------- */

/** Return the caller's referral code, generating + persisting one on first use.
 *  Uses the service role so the write isn't blocked by column-level RLS. */
export async function getOrCreateReferralCode() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) throw new Error("no_company");
  if (co.referral_code) return co.referral_code;
  const A = (await import("./supabase.js")).supabaseAdmin();
  // Try a few times in the (tiny) chance of a code collision on the unique index.
  for (let i = 0; i < 5; i++) {
    const code = shortCode(7);
    const { error } = await A.from("companies").update({ referral_code: code }).eq("id", co.id);
    if (!error) return code;
    if (!/duplicate|unique/i.test(error.message || "")) {
      // Column not there yet (migration not run) or other error — degrade gracefully.
      return co.id.slice(0, 8);
    }
  }
  return co.id.slice(0, 8);
}

/** List the companies this company has referred (for the /refer page). */
export async function listReferrals() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  if (!co) return [];
  const A = (await import("./supabase.js")).supabaseAdmin();
  const { data, error } = await A.from("referrals")
    .select("referred_name, status, created_at")
    .eq("referrer_company_id", co.id).order("created_at", { ascending: false });
  return error ? [] : (data || []);
}

/** Best-effort: if the visitor arrived via someone's referral link (a `vm_ref`
 *  cookie set on /login), attribute this new company to that referrer — once.
 *  Called from the dashboard on load and wrapped in try/catch by the caller so it
 *  can never break the page. No-ops silently before the migration runs. */
export async function maybeClaimReferral() {
  const { cookies } = await import("next/headers");
  const ref = cookies().get("vm_ref")?.value;
  if (!ref) return;
  const co = await currentCompany();
  if (!co || co.referred_by) return;              // already attributed or no company
  const A = (await import("./supabase.js")).supabaseAdmin();
  const { data: referrer } = await A.from("companies")
    .select("id, name").eq("referral_code", ref).maybeSingle();
  if (!referrer || referrer.id === co.id) return; // unknown code or self-referral
  const { error } = await A.from("companies").update({ referred_by: referrer.id }).eq("id", co.id);
  if (error) return;                               // column missing → stop quietly
  await A.from("referrals").insert({
    referrer_company_id: referrer.id, referred_company_id: co.id,
    referred_name: co.name || "", status: "signed_up",
  });
  try {
    await logActivity(A, { companyId: referrer.id, kind: "sys",
      key: "act_referral_joined", params: { b: co.name || "A new installer" },
      text: `${co.name || "A new installer"} joined via your referral link` });
  } catch {}
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
    .insert({ company_id: co.id, ...productFull(patch) }).select("*").single();
  if (missingStockCol(error)) {  // pre add-product-stock.sql: keep the photo, drop inventory
    ({ data, error } = await sb.from("products")
      .insert({ company_id: co.id, ...productWithImage(patch) }).select("*").single());
  }
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
  let { error } = await sb.from("products").update(productFull(patch)).eq("id", id);
  if (missingStockCol(error)) {  // pre add-product-stock.sql: keep the photo, drop inventory
    ({ error } = await sb.from("products").update(productWithImage(patch)).eq("id", id));
  }
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
  // Was relying entirely on RLS: a signed-out call matched no rows and returned
  // success, so the UI reported a delete that never happened.
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if ((await getMyRole()) !== "owner") throw new Error("owner_only");
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
  // mdDayKey, not toISOString(): every other date in the app is app-timezone,
  // and UTC stamped a step ticked at 01:30 in Chisinau with the previous day.
  if (done) prog[step] = mdDayKey(Date.now());
  else delete prog[step];
  // This write was unchecked, so a failure resolved as success — the optimistic
  // tick stayed on screen and the installer believed a step was recorded.
  const { error } = await sb.from("projects").update({ install_progress: prog }).eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  // Hand the merged map back. This is a read-modify-write on a JSONB column, so
  // two people working the same job can still clobber one another; returning the
  // server's view lets the UI re-sync on every toggle instead of drifting
  // silently until the next reload.
  return prog;
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
  // One update, not two. As separate writes the second could fail on its own,
  // leaving a lead linked to a project but still sitting in the "new" queue
  // forever — converted in fact, unconverted in the UI.
  const { error: linkErr } = await sb.from("leads")
    .update({ project_id: data.id, status: "converted" }).eq("id", id);
  if (linkErr) console.error("[lead->project] link failed:", linkErr.message);
  await logActivity(sb, { companyId: co.id, kind: "quote", key: "act_quote_from_lead", text: "Quote created from a lead", actor: await currentActor(), link: `/projects/${data.id}` });
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
  await logActivity(sb, { companyId: co.id, kind: "quote", key: "act_quote_created", text: "New quote created", actor: await currentActor(), link: `/projects/${data.id}` });
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
    // Deleting the book of business is an owner action. RLS already confines
    // this to the caller's own company, but any member could previously wipe
    // 200 quotes in one click — Settings gates far less destructive things
    // (engine, subsidies) behind the same check.
    if ((await getMyRole()) !== "owner") throw new Error("owner_only");
    const { error } = await sb.from("projects").delete().in("id", clean);
    if (error) throw new Error(error.message);
    return;
  }
  if (["draft", "sent", "won", "lost"].includes(op)) {
    // Unchecked, a failed bulk update returned success and the UI refreshed to
    // show the old statuses with no explanation.
    const { error } = await sb.from("projects").update({ status: op }).in("id", clean);
    if (error) throw new Error(error.message);
  }
}

/** Duplicate a project (demo's row "duplicate" action). Copies every quote
 *  input into a fresh draft titled "… (copy)". RLS scopes read + write. */
export async function duplicateProject(id) {
  const sb = supabaseServer();
  const { data: p } = await sb.from("projects").select("*").eq("id", id).single();
  if (!p) return null;
  // Strip everything that identifies the ORIGINAL rather than describing the
  // system. Carrying these over caused real damage:
  //   sample              — a copy of a seeded row stayed flagged, so "Clear
  //                         sample data" deleted the real quote it became.
  //   invoice_no          — two projects ended up sharing one proforma number,
  //                         defeating the atomic next_invoice_no() sequence.
  //   install_progress    — a brand-new draft was born "5/6 installed".
  //   followup_snoozed_at — the copy inherited a snooze it never earned.
  const {
    id: _id, created_at, updated_at,
    sample: _sample, invoice_no: _invNo,
    install_progress: _install, followup_snoozed_at: _snoozed,
    ...rest
  } = p;
  const { data, error } = await sb.from("projects").insert({
    ...rest,
    title: (p.title || "Untitled") + " (copy)",
    status: "draft",
    install_progress: {},
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
  await logActivity(sb, {
    companyId: p.company_id, kind: "won", key: "act_won",
    params: { b: p.title || "" },
    text: `Marked <b>${escapeHtml(p.title || "")}</b> as won`,
    actor: await currentActor(), link: `/projects/${id}`,
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
