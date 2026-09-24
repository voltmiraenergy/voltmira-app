// lib/demoSeed.js — builds a complete, disposable demo tenant.
//
// WHY THIS EXISTS: /demo used to serve app/_landing/demo.html, a hand-written
// vanilla-JS clone of the dashboard. Every feature shipped to the real app had
// to be re-implemented there by hand, so it fell behind — no Team page, no
// install checklist, no BOM, no follow-up strip. A demo that lies about the
// product is worse than no demo.
//
// So the demo is no longer a copy. /demo creates a real company, seeds it with
// a realistic installer's book of business, and signs the visitor in. From that
// point they are running the actual app — same components, same engine, same
// SQL. It cannot drift, because there is nothing to keep in sync.
//
// Everything here runs through the SERVICE ROLE: we are creating a tenant from
// nothing, so there is no session to scope RLS by yet.
import { supabaseAdmin } from "./supabase.js";
import { DEMO_DOMAIN } from "./demo.js";
import { autoBom } from "./supplierCatalog.js";
import { defaultEngineSettings } from "@voltmira/engine";

// The one seeded project that carries a real bill of materials, so a fresh
// demo has something to show for the equipment datasheet / MPPT compliance
// matrix on the client proposal PDF (app/p/[code]/PrintSheet.jsx) without the
// visitor having to build a BOM by hand first. Every other seeded project
// stays BOM-less, exactly as before — this one exists so /demo?next=pdf-annex
// (see resolvePdfDemoDest below and app/demo/route.js) has a fixed, findable
// target regardless of which random tenant gets created.
const PDF_DEMO_PROJECT_TITLE = "Vila Popescu, Iași";

// Same alphabet as createProposal's shortCode — proposal codes appear in public
// /p/<code> URLs, so they avoid vowels (no accidental words) and lookalikes.
const ALPHABET = "23456789bcdfghjkmnpqrstvwxyz";
const shortCode = (n = 8) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
/** Date-only (YYYY-MM-DD) — install_progress stores a completion DATE per step. */
const agoDate = (d) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);

// Mirrors INSTALL_STEPS in dashboard/page.jsx and InstallChecklist.jsx. Order
// matters: a project "in installation" is one with ≥1 and <6 steps done, so the
// prefix length below decides which deals show on the install card.
const INSTALL_STEPS = ["deposit", "permit", "order", "install", "grid", "commission"];
/** First `n` steps completed, back-dated so the timeline reads plausibly. */
function installProgress(n, startedAgo) {
  const out = {};
  for (let i = 0; i < n; i++) out[INSTALL_STEPS[i]] = agoDate(Math.max(0, startedAgo - i * 6));
  return out;
}

// ---------------------------------------------------------------- the team
// role is the PERMISSION (owner|member — the DB check constraint allows only
// those two). title is the SPECIALISATION the Team page colours and labels by.
// Four people fills the 5-seat "team" plan without maxing it, so the seat meter
// shows 4/5 rather than a full bar.
const TEAM = [
  { key: "owner", name: "Andrei Mocanu",   title: "",         role: "owner",  phone: "+40 745 210 884" },
  { key: "sales", name: "Elena Vasilache", title: "sales",    role: "member", phone: "+40 733 918 402" },
  { key: "eng",   name: "Radu Ionescu",    title: "engineer", role: "member", phone: "+40 726 445 130" },
  { key: "mgr",   name: "Cristina Dumitru",title: "manager",  role: "member", phone: "+40 751 662 977" },
];

// ------------------------------------------------------------- the pipeline
// Dates are all relative to "now", which is what makes the seeded workspace
// look alive whenever it is opened. Each field is chosen to light up a specific
// piece of the dashboard — see the comment on each group.
//
//   sent  = days ago the proposal was created  -> drives the 6-month trend bars
//   won   = days ago the client accepted       -> drives wins + avg time-to-close
//   opens / lastOpen                           -> drives the conversion funnel
//   install                                    -> drives the "in installation" card
//
// Follow-up rule (lib/proposalStats.js needsFollowUp): sent >7d ago AND not
// opened in the last 7d. Rows 3, 10 and 14 below are built to trip it, so the
// "Needs follow-up" strip is never empty on a fresh demo.
const PIPELINE = [
  // --- won, fully commissioned (6/6 → deliberately NOT on the install card) ---
  { t: "Casa Rusu, Chișinău",            c: "Andrei Rusu",      m: "MD", kw: 8,  cons: 6000,  batt: true,  o: 0, status: "won",   sent: 160, won: 150, opens: 6, lastOpen: 149, install: 6, startedAgo: 145 },
  { t: "Vila Andrieș, Suceava",          c: "Radu Andrieș",     m: "RO", kw: 9,  cons: 7200,  batt: false, o: 1, status: "won",   sent: 100, won: 92,  opens: 5, lastOpen: 91,  install: 6, startedAgo: 88 },
  { t: "Casa Grosu, Strășeni",           c: "Vasile Grosu",     m: "MD", kw: 7,  cons: 5400,  batt: true,  o: 0, status: "won",   sent: 130, won: 120, opens: 4, lastOpen: 119, install: 6, startedAgo: 115 },

  // --- won, mid-install (1..5 of 6 → these populate the install card) ---
  { t: "Casă Munteanu, Cluj",            c: "Vlad Munteanu",    m: "RO", kw: 5,  cons: 4000,  batt: false, o: 1, status: "won",   sent: 70,  won: 62,  opens: 3, lastOpen: 61,  install: 3, startedAgo: 55 },
  { t: "Casa Bejan, Ungheni",            c: "Sergiu Bejan",     m: "MD", kw: 6,  cons: 4600,  batt: true,  o: 2, status: "won",   sent: 45,  won: 38,  opens: 4, lastOpen: 37,  install: 5, startedAgo: 34 },
  { t: "Pensiunea Bucovina, G. Humorului",c: "Ana Cojocaru",    m: "RO", kw: 15, cons: 12000, batt: true,  o: 0, status: "won",   sent: 30,  won: 22,  opens: 7, lastOpen: 21,  install: 2, startedAgo: 18 },
  { t: "Casa Damian, Iași",              c: "Alina Damian",     m: "sales", os: 1, kw: 6, cons: 4800, batt: false, status: "won", sent: 14, won: 6,   opens: 3, lastOpen: 5,   install: 1, startedAgo: 4 },

  // --- sent, healthy engagement (funnel: opened / engaged) ---
  // batt:true here (was false) so PDF_DEMO_PROJECT_TITLE's fixed deep links
  // (see resolvePdfDemoDest/resolveEditorDemoDest below) also demo the hybrid
  // system-type UI and the backup-power callout, not just the panel/inverter
  // catalog data the title was originally picked for.
  { t: "Vila Popescu, Iași",             c: "Ion Popescu",      m: "RO", kw: 6,  cons: 4800,  batt: true, o: 1, status: "sent",  sent: 12,  opens: 4, lastOpen: 1 },
  { t: "Casa Sîrbu, Chișinău",           c: "Dumitru Sîrbu",    m: "MD", kw: 6,  cons: 4500,  batt: false, o: 3, status: "sent",  sent: 5,   opens: 3, lastOpen: 1 },
  { t: "Hala Industrială, Iași",         c: "SC Metalux SRL",   m: "RO", kw: 30, cons: 26000, batt: false, o: 2, status: "sent",  sent: 9,   opens: 2, lastOpen: 2 },

  // --- sent but going cold (these three trip the follow-up strip) ---
  { t: "Pensiune Verde, Bălți",          c: "Maria Ciobanu",    m: "MD", kw: 12, cons: 9000,  batt: true,  o: 1, status: "sent",  sent: 26,  opens: 1, lastOpen: 20 },
  { t: "Depozit Agro, Cahul",            c: "Agroterra SRL",    m: "MD", kw: 25, cons: 21000, batt: false, o: 3, status: "sent",  sent: 35,  opens: 0, lastOpen: null },
  { t: "Fabrica Textil, Bacău",          c: "Textilmod SA",     m: "RO", kw: 40, cons: 38000, batt: false, o: 2, status: "sent",  sent: 18,  opens: 1, lastOpen: 15 },

  // --- lost (so the win-rate KPI is a real number, not 100%) ---
  { t: "Casa Rotaru, Chișinău",          c: "Elena Rotaru",     m: "MD", kw: 7,  cons: 5500,  batt: false, o: 3, status: "lost",  sent: 88,  opens: 2, lastOpen: 80 },
  { t: "Vila Lazăr, Piatra Neamț",       c: "Cristian Lazăr",   m: "RO", kw: 10, cons: 8200,  batt: false, o: 1, status: "lost",  sent: 55,  opens: 1, lastOpen: 50 },

  // --- drafts (no proposal yet — shows the "not sent" state in the table) ---
  { t: "Fermă Solar, Orhei",             c: "Petru Lungu",      m: "MD", kw: 20, cons: 15000, batt: false, o: 0, status: "draft", age: 3 },
  { t: "Casa Ciobanu, Botoșani",         c: "Mihai Ciobanu",    m: "RO", kw: 5,  cons: 3900,  batt: false, o: 2, status: "draft", age: 6 },
  { t: "Complex Comercial, Chișinău",    c: "Nord Group SRL",   m: "MD", kw: 50, cons: 44000, batt: false, o: 0, status: "draft", age: 1 },
];

// Catalog: the SAME real, manufacturer-verified SKUs as lib/supplierCatalog.js
// (brand/model matched exactly, on purpose — so findWarrantyInfo() recognizes
// these when the installer re-adds one to a new quote, and the demo catalog
// page has real product photos instead of the generic kind-icon placeholder).
// Previously a separate, fictional model list (JAM54S30-410/MR, SUN2000-6KTL-L1,
// etc.) that matched nothing real: no photo, no warranty lookup, and numbers
// nobody could check. Stock/tracking variety (one out-of-stock panel, one
// untracked inverter, untracked mounts) is preserved from the original list.
const PRODUCTS = [
  { kind: "panel",    brand: "JA Solar",       model: "JAM54D40 440W",              spec: "440 W",  unit_price: 76,   stock: 240, track_stock: true,  image_url: "https://www.jasolar.eu/fileadmin/_processed_/3/9/csm_JAM_54_D40_MB_frontal_vorne_1_368324eb73.webp" },
  { kind: "panel",    brand: "LONGi",          model: "Hi-MO 6 Explorer LR5-54HTH", spec: "435 W",  unit_price: 78,   stock: 160, track_stock: true,  image_url: "https://static.longi.com/Explorer_06_2c0e9cf07e.png" },
  { kind: "panel",    brand: "Canadian Solar", model: "HiHero CS6.5 445W",          spec: "445 W",  unit_price: 82,   stock: 0,   track_stock: true,  image_url: "https://www.canadiansolar.com/na/wp-content/uploads/sites/3/2026/02/LC%E5%AE%98%E7%BD%91%E7%9B%AE%E5%BD%95%E9%A1%B5Previous-600-x-700.png" },
  { kind: "inverter", brand: "Huawei",         model: "SUN2000-10KTL-M1",           spec: "10 kW",  unit_price: 980,  stock: 7,   track_stock: true,  image_url: "https://solar.huawei.com/admin/asset/v1/pro/view/bcf9419a00e44d1ea412454838446a1e.png" },
  { kind: "inverter", brand: "Deye",           model: "SUN-6K-SG04LP3",             spec: "6 kW hybrid", unit_price: 820, stock: 12, track_stock: true, image_url: "https://www.deyeinverter.com/deyeinverter/2026/08/05/sg061.jpg" },
  { kind: "inverter", brand: "Solis",          model: "S6-GR1P(3-10)K",             spec: "5 kW",   unit_price: 520,  stock: 3,   track_stock: false, image_url: "https://cmsdata.solisinverters.com/uploads/image/20230424/8lJjqfwOaAroVGzMFmM6B9Ay1ee4YCFcJPL0ABUP.png" },
  { kind: "battery",  brand: "Pylontech",      model: "US5000 × 2",                 spec: "9.6 kWh",unit_price: 2380, stock: 6,   track_stock: true,  image_url: "https://www.nkon.nl/media/catalog/product/cache/634f00c0cac7a25d9ea011187773489b/u/s/us5000c_1.png" },
  { kind: "battery",  brand: "Huawei",         model: "LUNA2000-5-E0",              spec: "5.0 kWh",unit_price: 1340, stock: 9,   track_stock: true,  image_url: "https://solar.huawei.com/admin/asset/v1/pro/view/f5e0c1c5666748f89154729f71fd9f6a.png" },
  { kind: "mounting", brand: "K2 Systems",     model: "SingleRail 48 / Speed Rail", spec: "roof, tile hooks", unit_price: 60, stock: 0, track_stock: false, image_url: "https://k2-systems.com/wp-content/uploads/2022/03/SingleRail-title.jpg" },
  { kind: "mounting", brand: "Schletter",      model: "Rapid16",                    spec: "roof, trapezoidal sheet", unit_price: 55, stock: 0, track_stock: false, image_url: "https://strapi.schletter-group.com/uploads/webloop_thumbnail_pitchedroof_d123154512.jpg" },
  // No real manufacturer SKU for a generic accessory — image_url stays "",
  // never a stock photo pretending to be a real product. Must still be
  // PRESENT (not omitted) though: PostgREST unions the key set across a
  // batch insert, so once any row in the batch sets image_url, a row that
  // omits the key entirely gets an explicit NULL instead of the column
  // default — and image_url is NOT NULL, which fails the whole batch.
  { kind: "other",    brand: "Generic",        model: "AC/DC protection kit",       spec: "per system", unit_price: 145, stock: 0, track_stock: false, image_url: "" },
];

const LEADS = [
  { name: "Grigore Cebotari", source: "manual", phone: "+373 691 22 145", email: "",                             channel: "whatsapp",  status: "new",       hot: true,  note: "Vrea 6 kW + baterie, a scris pe WhatsApp.", days: 1 },
  { name: "Natalia Cazacu", source: "widget",   phone: "",                email: "natalia.cazacu@gmail.com",     channel: "website",   status: "new",       hot: true,  note: "Formular pe site, acoperiș 120 m² în Chișinău.", days: 2 },
  { name: "Sergiu Vasilache", source: "manual", phone: "+373 601 90 322", email: "",                             channel: "referral",  status: "contacted", hot: false, note: "Recomandat de un vecin din Bălți.", days: 4 },
  { name: "Dumitru Sîrbu", source: "manual",    phone: "+373 678 41 208", email: "",                             channel: "coldcall",  status: "new",       hot: false, note: "Apel la rece, interesat pentru primăvară.", days: 6 },
  { name: "Ioana Marinescu", source: "widget",  phone: "+40 744 512 003", email: "ioana.m@outlook.com",          channel: "google",    status: "contacted", hot: false, note: "Caută ofertă pentru casă nouă în Iași.", days: 9 },
  { name: "Victor Ganea", source: "manual",     phone: "+373 688 77 214", email: "",                             channel: "facebook",  status: "new",       hot: false, note: "A comentat la postarea cu proiectul din Ungheni.", days: 12 },
  { name: "Mihai Roșca", source: "proposal",      phone: "+40 722 908 441", email: "mihai.rosca@yahoo.com",        channel: "instagram", status: "contacted", hot: false, note: "Vrea și încărcător EV inclus în ofertă.", days: 16 },
];

/**
 * Create a fully seeded demo tenant and return the owner's identity.
 * The caller (app/demo/route.js) signs the visitor in via a service-role
 * magic link (id + email) — not the password, which exists only so the
 * owner's real auth user has one, matching every other real account.
 *
 * @param {"en"|"ro"|"ru"} lang  UI language for the workspace.
 * @returns {Promise<{id:string,email:string,password:string}>}
 */
export async function createDemoWorkspace(lang = "ro") {
  const admin = supabaseAdmin();
  const tag = shortCode(10);

  // ---- 1. the tenant -------------------------------------------------
  // plan "team" gives a 5-seat cap, so the Team page's seat meter reads 4/5
  // (a full bar would hide the invite flow we want to demo).
  const companyRow = {
    name: "SolarTech Iași",
    short_name: "SolarTech",
    default_market: "RO",
    currency: "EUR",
    lang,
    plan: "team",
    subsidy_amount_ron: 20000,
    prosumer_limit_kw: 10.8,
    // Settings page has something real to show instead of empty inputs.
    legal_name: "SOLARTECH INSTAL SRL",
    reg_no: "J22/1840/2019",
    vat_no: "RO41250883",
    legal_address: "Str. Palat 12, Iași 700051, România",
    iban: "RO49 AAAA 1B31 0075 9384 0000",
    invoice_prefix: "STI",
    invoice_seq: 47,
    vat_rate: 19,
    referral_code: "solartech-" + tag.slice(0, 5),
  };
  const ins = await admin.from("companies").insert(companyRow).select("*").single();
  if (ins.error) throw new Error("demo_company: " + ins.error.message);
  const co = ins.data;

  // ---- 2. the people -------------------------------------------------
  // Team members must be real auth users: profiles.id is a FK to auth.users,
  // and the Team page reads last_sign_in_at off the auth record to tell
  // "joined" from "invited". Passwords are random and never surfaced except
  // for the owner, who is the one we sign in.
  const password = shortCode(24);
  const people = await Promise.all(TEAM.map(async (m, i) => {
    const email = `demo-${tag}-${m.key}@${DEMO_DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: i === 0 ? password : shortCode(24),
      email_confirm: true,
      user_metadata: { demo: true, name: m.name },
    });
    if (error) throw new Error("demo_user(" + m.key + "): " + error.message);
    return { ...m, id: data.user.id, email };
  }));

  const profileRows = people.map((p) => ({
    id: p.id, company_id: co.id, name: p.name, role: p.role,
    email: p.email, title: p.title, phone: p.phone,
    created_at: ago(180),
  }));
  const pErr = (await admin.from("profiles").insert(profileRows)).error;
  if (pErr) throw new Error("demo_profiles: " + pErr.message);

  // ---- 3. catalog ----------------------------------------------------
  await admin.from("products").insert(
    PRODUCTS.map((p) => ({ ...p, company_id: co.id, active: true, created_at: ago(120) }))
  );

  // ---- 4. pipeline ---------------------------------------------------
  const projectRows = PIPELINE.map((p) => {
    // `o` indexes TEAM; a couple of rows use `os` for readability. Fall back to
    // the owner so a typo can never produce an unassigned project (which would
    // silently drop it out of the Team leaderboard).
    const ownerIdx = typeof p.o === "number" ? p.o : (typeof p.os === "number" ? p.os : 0);
    const createdAgo = p.sent != null ? p.sent + 8 : (p.age ?? 5);
    const updatedAgo = p.won != null ? p.won : (p.sent != null ? Math.min(p.sent, p.lastOpen ?? p.sent) : createdAgo);
    return {
      company_id: co.id,
      owner_id: people[ownerIdx].id,
      title: p.t,
      client_name: p.c,
      // A resolved pin, real-Iași coordinates, only on PDF_DEMO_PROJECT_TITLE
      // — so /demo?next=site-designer-demo can open Site Designer with its
      // "draw the roof" button already enabled, instead of asking the visitor
      // to type an address first. Every other seeded project keeps address:""
      // exactly as before.
      address: p.t === PDF_DEMO_PROJECT_TITLE ? "Str. Toma Cozma 12, Iași" : "",
      lat: p.t === PDF_DEMO_PROJECT_TITLE ? 47.1719 : null,
      lon: p.t === PDF_DEMO_PROJECT_TITLE ? 27.5809 : null,
      market: p.m === "MD" || p.m === "RO" ? p.m : "RO",
      status: p.status,
      kw: p.kw,
      cons: p.cons,
      // Tariff per market: RO ~0.21 €/kWh, MD ~0.18 €/kWh.
      price: (p.m === "MD" ? 0.18 : 0.21),
      batt: !!p.batt,
      batt_kwh: p.batt ? 10 : 10,
      // Real supplier-catalog gear on the one project that exists to
      // demonstrate it — see PDF_DEMO_PROJECT_TITLE above. Everything else
      // keeps the empty BOM it always had.
      bom: p.t === PDF_DEMO_PROJECT_TITLE ? autoBom(p.kw, p.batt ? 10 : 0) : [],
      sample: true,
      install_progress: p.install ? installProgress(p.install, p.startedAgo ?? 10) : {},
      created_at: ago(createdAgo),
      updated_at: ago(updatedAgo),
    };
  });
  const projIns = await admin.from("projects").insert(projectRows).select("*");
  if (projIns.error) throw new Error("demo_projects: " + projIns.error.message);
  const projects = projIns.data || [];

  // ---- 5. proposals (the tracking layer) ------------------------------
  // These drive the trend chart, the funnel, avg time-to-close and the
  // follow-up strip — every one of those reads `proposals`, not `projects`.
  const byTitle = new Map(projects.map((r) => [r.title, r]));
  const proposalRows = [];
  for (const p of PIPELINE) {
    if (p.sent == null) continue;             // drafts have no share link yet
    const proj = byTitle.get(p.t);
    if (!proj) continue;
    proposalRows.push({
      code: shortCode(),
      project_id: proj.id,
      company_id: co.id,
      // Frozen snapshot, same shape the editor writes on send.
      snapshot: {
        title: proj.title, client: proj.client_name, address: "",
        kw: Number(proj.kw), price: Number(proj.price), cons: Number(proj.cons),
        batt: proj.batt, battKwh: 10, options: [],
        // Mirror the project's own BOM rather than hardcoding empty — a
        // frozen proposal that silently disagreed with its project's
        // equipment would be exactly the kind of drift this demo exists to
        // avoid. Every row still resolves to [] except PDF_DEMO_PROJECT_TITLE.
        bom: Array.isArray(proj.bom) ? proj.bom : [], costOverride: 0,
        market: proj.market, useMonthly: false, consMonthly: null,
        afmSubsidy: proj.afm_subsidy, loanMonthly: 118,
        // Full defaults, not just the one field this used to hand-list — a
        // real proposal freezes via snapshotEngine(), which always starts
        // from defaultEngineSettings(); a demo proposal missing newer fields
        // (like financeRatePct/financeTermYears) silently under-demos
        // whatever feature reads them.
        engine: { ...defaultEngineSettings(), ...(co.engine || {}), subsidyAmountRon: Number(co.subsidy_amount_ron ?? 20000) },
      },
      opens: p.opens ?? 0,
      seconds: (p.opens ?? 0) * 47,
      batt_toggles: p.batt ? 2 : 0,
      last_open: p.lastOpen != null ? ago(p.lastOpen) : null,
      accepted_at: p.won != null ? ago(p.won) : null,
      signer_name: p.won != null ? p.c : null,
      created_at: ago(p.sent),
    });
  }
  const propErr = (await admin.from("proposals").insert(proposalRows)).error;
  if (propErr) throw new Error("demo_proposals: " + propErr.message);

  // ---- 6. leads ------------------------------------------------------
  await admin.from("leads").insert(LEADS.map((l) => ({
    company_id: co.id, name: l.name, email: l.email, phone: l.phone,
    note: l.note, hot: l.hot, source: l.source || "manual", channel: l.channel,
    status: l.status, sample: true, created_at: ago(l.days),
  })));

  // ---- 7. activity feed ----------------------------------------------
  // i18n `key` + `params` render through lib/activity.js, so the feed shows in
  // whichever language the workspace is set to. `text` is the legacy fallback.
  const owner = people[0], sales = people[1], eng = people[2];
  const feed = [
    { kind: "won",   key: "act_won",        params: { b: "Casa Damian, Iași" },                          text: "Marked <b>Casa Damian, Iași</b> as won",                       actor: owner, days: 6 },
    { kind: "lead",  key: "act_opened_hot", params: { b: "Ion Popescu", title: "Vila Popescu, Iași", n: 4 }, text: "<b>Ion Popescu</b> opened “Vila Popescu, Iași” again, 4× total. Worth a call now.", actor: null, days: 1 },
    { kind: "lead",  key: "act_lead_widget",params: { b: "Natalia Cazacu" },                              text: "New lead from the website widget: <b>Natalia Cazacu</b>",       actor: null, days: 2 },
    { kind: "sent",  key: "act_sent",       params: { b: "Casa Sîrbu, Chișinău" },                       text: "Sent <b>Casa Sîrbu, Chișinău</b>",                             actor: sales, days: 5 },
    { kind: "sent",  key: "act_sent",       params: { b: "Hala Industrială, Iași" },                     text: "Sent <b>Hala Industrială, Iași</b>",                           actor: eng,   days: 9 },
    { kind: "won",   key: "act_won",        params: { b: "Pensiunea Bucovina, G. Humorului" },           text: "Marked <b>Pensiunea Bucovina, G. Humorului</b> as won",        actor: owner, days: 22 },
    { kind: "sent",  key: "act_sent",       params: { b: "Fabrica Textil, Bacău" },                      text: "Sent <b>Fabrica Textil, Bacău</b>",                            actor: eng,   days: 18 },
    { kind: "lead",  key: "act_lead_widget",params: { b: "Grigore Cebotari" },                            text: "New lead from the website widget: <b>Grigore Cebotari</b>",     actor: null,  days: 1 },
  ];
  await admin.from("activity").insert(feed.map((f) => ({
    company_id: co.id, kind: f.kind, key: f.key, params: f.params, text: f.text,
    actor_id: f.actor?.id ?? null, actor_name: f.actor?.name ?? "",
    created_at: ago(f.days),
  })));

  return { id: people[0].id, email: people[0].email, password };
}

/**
 * Where the "see the enriched proposal PDF" deep link (/demo?next=pdf-annex)
 * actually goes, for whichever demo tenant this visitor is signed into.
 *
 * Proposal codes are random per tenant (necessarily — see createProposal:
 * they're globally unique, so a fixed literal code would collide across
 * concurrent demo sessions), so a stable "next" VALUE can't be a hardcoded
 * path the way /catalog or /leads are. Instead this looks up, by the one
 * fixed and findable thing that IS stable — PDF_DEMO_PROJECT_TITLE — whatever
 * code this specific tenant's seed actually generated.
 *
 * Runs on the service role: the caller (app/demo/route.js) has only just
 * authenticated this user and there's no reason to fight RLS for a read this
 * narrowly scoped (by the user's own company_id) and this low-stakes (a
 * public proposal code the client is about to be handed anyway).
 *
 * @returns {Promise<string|null>} "/p/<code>?print=1", or null if this user
 *   has no demo company / no such project / no proposal yet (never thrown —
 *   the caller falls back to /dashboard exactly like an invalid `next` would).
 */
async function findDemoProposalCode(userId) {
  if (!userId) return null;
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) return null;
  const { data: proj } = await admin.from("projects").select("id")
    .eq("company_id", profile.company_id).eq("title", PDF_DEMO_PROJECT_TITLE).maybeSingle();
  if (!proj) return null;
  const { data: prop } = await admin.from("proposals").select("code")
    .eq("project_id", proj.id).maybeSingle();
  return prop?.code || null;
}

export async function resolvePdfDemoDest(userId) {
  const code = await findDemoProposalCode(userId);
  return code ? `/p/${code}?print=1` : null;
}

/**
 * Where the "see the live/mobile proposal" deep link
 * (/demo?next=proposal-demo) goes — the SAME proposal as resolvePdfDemoDest,
 * minus ?print=1: the page the CLIENT actually opens on their phone (real
 * charts, the live self-audit sliders, the cash/monthly financing toggle),
 * as opposed to the PDF a browser or Chromium renders for download.
 *
 * @returns {Promise<string|null>} "/p/<code>", or null (falls back to
 *   /dashboard) if this user has no demo company / no proposal yet.
 */
export async function resolveProposalDemoDest(userId) {
  const code = await findDemoProposalCode(userId);
  return code ? `/p/${code}` : null;
}

/**
 * Where the "see the hybrid-system editor UI" deep link
 * (/demo?next=hybrid-demo) goes — the SAME PDF_DEMO_PROJECT_TITLE project
 * (it already has a real BOM and, now, batt:true), just landing in the
 * editor instead of the printed proposal. Same lookup shape as
 * resolvePdfDemoDest, minus the proposal hop since a project id needs no
 * further resolution — /projects/[id] is a fixed, stable path per tenant.
 *
 * @returns {Promise<string|null>} "/projects/<id>", or null (falls back to
 *   /dashboard) if this user has no demo company / no such project yet.
 */
export async function resolveEditorDemoDest(userId) {
  if (!userId) return null;
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) return null;
  const { data: proj } = await admin.from("projects").select("id")
    .eq("company_id", profile.company_id).eq("title", PDF_DEMO_PROJECT_TITLE).maybeSingle();
  if (!proj) return null;
  return `/projects/${proj.id}`;
}

/**
 * Where the public quick-estimate widget demo (/demo?next=widget-demo) goes —
 * the widget is a public, unauthenticated page keyed by company id
 * (app/widget/page.jsx's `?c=`), and a fresh demo tenant's id is only known
 * after createDemoWorkspace() has actually run, so it can't be a fixed path
 * the way /catalog is. Same lookup shape as the other resolvers here, minus
 * the project hop — this only needs the visitor's own company id.
 *
 * @returns {Promise<string|null>} "/widget?c=<company id>&lang=ro", or null
 *   (falls back to /dashboard) if this user has no demo company.
 */
export async function resolveWidgetDemoDest(userId) {
  if (!userId) return null;
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) return null;
  return `/widget?c=${profile.company_id}&lang=ro`;
}
