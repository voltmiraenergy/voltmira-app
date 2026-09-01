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
  { t: "Casa Rusu — Chișinău",            c: "Andrei Rusu",      m: "MD", kw: 8,  cons: 6000,  batt: true,  o: 0, status: "won",   sent: 160, won: 150, opens: 6, lastOpen: 149, install: 6, startedAgo: 145 },
  { t: "Vila Andrieș — Suceava",          c: "Radu Andrieș",     m: "RO", kw: 9,  cons: 7200,  batt: false, o: 1, status: "won",   sent: 100, won: 92,  opens: 5, lastOpen: 91,  install: 6, startedAgo: 88 },
  { t: "Casa Grosu — Strășeni",           c: "Vasile Grosu",     m: "MD", kw: 7,  cons: 5400,  batt: true,  o: 0, status: "won",   sent: 130, won: 120, opens: 4, lastOpen: 119, install: 6, startedAgo: 115 },

  // --- won, mid-install (1..5 of 6 → these populate the install card) ---
  { t: "Casă Munteanu — Cluj",            c: "Vlad Munteanu",    m: "RO", kw: 5,  cons: 4000,  batt: false, o: 1, status: "won",   sent: 70,  won: 62,  opens: 3, lastOpen: 61,  install: 3, startedAgo: 55 },
  { t: "Casa Bejan — Ungheni",            c: "Sergiu Bejan",     m: "MD", kw: 6,  cons: 4600,  batt: true,  o: 2, status: "won",   sent: 45,  won: 38,  opens: 4, lastOpen: 37,  install: 5, startedAgo: 34 },
  { t: "Pensiunea Bucovina — G. Humorului",c: "Ana Cojocaru",    m: "RO", kw: 15, cons: 12000, batt: true,  o: 0, status: "won",   sent: 30,  won: 22,  opens: 7, lastOpen: 21,  install: 2, startedAgo: 18 },
  { t: "Casa Damian — Iași",              c: "Alina Damian",     m: "sales", os: 1, kw: 6, cons: 4800, batt: false, status: "won", sent: 14, won: 6,   opens: 3, lastOpen: 5,   install: 1, startedAgo: 4 },

  // --- sent, healthy engagement (funnel: opened / engaged) ---
  { t: "Vila Popescu — Iași",             c: "Ion Popescu",      m: "RO", kw: 6,  cons: 4800,  batt: false, o: 1, status: "sent",  sent: 12,  opens: 4, lastOpen: 1 },
  { t: "Casa Sîrbu — Chișinău",           c: "Dumitru Sîrbu",    m: "MD", kw: 6,  cons: 4500,  batt: false, o: 3, status: "sent",  sent: 5,   opens: 3, lastOpen: 1 },
  { t: "Hala Industrială — Iași",         c: "SC Metalux SRL",   m: "RO", kw: 30, cons: 26000, batt: false, o: 2, status: "sent",  sent: 9,   opens: 2, lastOpen: 2 },

  // --- sent but going cold (these three trip the follow-up strip) ---
  { t: "Pensiune Verde — Bălți",          c: "Maria Ciobanu",    m: "MD", kw: 12, cons: 9000,  batt: true,  o: 1, status: "sent",  sent: 26,  opens: 1, lastOpen: 20 },
  { t: "Depozit Agro — Cahul",            c: "Agroterra SRL",    m: "MD", kw: 25, cons: 21000, batt: false, o: 3, status: "sent",  sent: 35,  opens: 0, lastOpen: null },
  { t: "Fabrica Textil — Bacău",          c: "Textilmod SA",     m: "RO", kw: 40, cons: 38000, batt: false, o: 2, status: "sent",  sent: 18,  opens: 1, lastOpen: 15 },

  // --- lost (so the win-rate KPI is a real number, not 100%) ---
  { t: "Casa Rotaru — Chișinău",          c: "Elena Rotaru",     m: "MD", kw: 7,  cons: 5500,  batt: false, o: 3, status: "lost",  sent: 88,  opens: 2, lastOpen: 80 },
  { t: "Vila Lazăr — Piatra Neamț",       c: "Cristian Lazăr",   m: "RO", kw: 10, cons: 8200,  batt: false, o: 1, status: "lost",  sent: 55,  opens: 1, lastOpen: 50 },

  // --- drafts (no proposal yet — shows the "not sent" state in the table) ---
  { t: "Fermă Solar — Orhei",             c: "Petru Lungu",      m: "MD", kw: 20, cons: 15000, batt: false, o: 0, status: "draft", age: 3 },
  { t: "Casa Ciobanu — Botoșani",         c: "Mihai Ciobanu",    m: "RO", kw: 5,  cons: 3900,  batt: false, o: 2, status: "draft", age: 6 },
  { t: "Complex Comercial — Chișinău",    c: "Nord Group SRL",   m: "MD", kw: 50, cons: 44000, batt: false, o: 0, status: "draft", age: 1 },
];

// Catalog: real hardware at realistic EUR trade prices, so the BOM builder and
// the catalog page both have something credible to show.
const PRODUCTS = [
  { kind: "panel",    brand: "JA Solar",    model: "JAM54S30-410/MR",  spec: "410 W",   unit_price: 78,   stock: 240, track_stock: true },
  { kind: "panel",    brand: "Longi",       model: "Hi-MO 6 LR5-54HTH",spec: "435 W",   unit_price: 89,   stock: 160, track_stock: true },
  { kind: "panel",    brand: "Canadian",    model: "TOPHiKu6 CS6.1",   spec: "455 W",   unit_price: 94,   stock: 0,   track_stock: true },
  { kind: "inverter", brand: "Huawei",      model: "SUN2000-6KTL-L1",  spec: "6 kW",    unit_price: 890,  stock: 12,  track_stock: true },
  { kind: "inverter", brand: "Huawei",      model: "SUN2000-10KTL-M1", spec: "10 kW",   unit_price: 1240, stock: 7,   track_stock: true },
  { kind: "inverter", brand: "Fronius",     model: "Symo GEN24 8.0",   spec: "8 kW",    unit_price: 1580, stock: 4,   track_stock: true },
  { kind: "inverter", brand: "Sungrow",     model: "SG20RT",           spec: "20 kW",   unit_price: 1690, stock: 3,   track_stock: false },
  { kind: "battery",  brand: "Huawei",      model: "LUNA2000-10-S0",   spec: "10 kWh",  unit_price: 3450, stock: 6,   track_stock: true },
  { kind: "battery",  brand: "Pylontech",   model: "US5000",           spec: "4.8 kWh", unit_price: 1290, stock: 9,   track_stock: true },
  { kind: "mounting", brand: "K2 Systems",  model: "SpeedRail set",    spec: "per kW",  unit_price: 62,   stock: 0,   track_stock: false },
  { kind: "mounting", brand: "Schletter",   model: "FixGrid 10",       spec: "flat roof/kW", unit_price: 81, stock: 0, track_stock: false },
  { kind: "other",    brand: "Generic",     model: "AC/DC protection kit", spec: "per system", unit_price: 145, stock: 0, track_stock: false },
];

const LEADS = [
  { name: "Grigore Cebotari", source: "manual", phone: "+373 691 22 145", email: "",                             channel: "whatsapp",  status: "new",       hot: true,  note: "Vrea 6 kW + baterie — a scris pe WhatsApp.", days: 1 },
  { name: "Natalia Cazacu", source: "widget",   phone: "",                email: "natalia.cazacu@gmail.com",     channel: "website",   status: "new",       hot: true,  note: "Formular pe site — acoperiș 120 m² în Chișinău.", days: 2 },
  { name: "Sergiu Vasilache", source: "manual", phone: "+373 601 90 322", email: "",                             channel: "referral",  status: "contacted", hot: false, note: "Recomandat de un vecin din Bălți.", days: 4 },
  { name: "Dumitru Sîrbu", source: "manual",    phone: "+373 678 41 208", email: "",                             channel: "coldcall",  status: "new",       hot: false, note: "Apel la rece — interesat pentru primăvară.", days: 6 },
  { name: "Ioana Marinescu", source: "widget",  phone: "+40 744 512 003", email: "ioana.m@outlook.com",          channel: "google",    status: "contacted", hot: false, note: "Caută ofertă pentru casă nouă în Iași.", days: 9 },
  { name: "Victor Ganea", source: "manual",     phone: "+373 688 77 214", email: "",                             channel: "facebook",  status: "new",       hot: false, note: "A comentat la postarea cu proiectul din Ungheni.", days: 12 },
  { name: "Mihai Roșca", source: "proposal",      phone: "+40 722 908 441", email: "mihai.rosca@yahoo.com",        channel: "instagram", status: "contacted", hot: false, note: "Vrea și încărcător EV inclus în ofertă.", days: 16 },
];

/**
 * Create a fully seeded demo tenant and return the owner's sign-in credentials.
 * The caller (app/demo/route.js) signs the visitor in with them.
 *
 * @param {"en"|"ro"|"ru"} lang  UI language for the workspace.
 * @returns {Promise<{email:string,password:string}>}
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
      address: "",
      market: p.m === "MD" || p.m === "RO" ? p.m : "RO",
      status: p.status,
      kw: p.kw,
      cons: p.cons,
      // Tariff per market: RO ~0.21 €/kWh, MD ~0.18 €/kWh.
      price: (p.m === "MD" ? 0.18 : 0.21),
      batt: !!p.batt,
      batt_kwh: p.batt ? 10 : 10,
      // AFM subsidy is a Romanian scheme — only meaningful on RO residential.
      afm_subsidy: p.m === "RO" && p.kw <= 10,
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
        batt: proj.batt, battKwh: 10, options: [], bom: [], costOverride: 0,
        market: proj.market, useMonthly: false, consMonthly: null,
        afmSubsidy: proj.afm_subsidy, loanMonthly: 118,
        engine: { ...(co.engine || {}), subsidyAmountRon: Number(co.subsidy_amount_ron ?? 20000) },
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
    { kind: "won",   key: "act_won",        params: { b: "Casa Damian — Iași" },                          text: "Marked <b>Casa Damian — Iași</b> as won",                       actor: owner, days: 6 },
    { kind: "lead",  key: "act_opened_hot", params: { b: "Ion Popescu", title: "Vila Popescu — Iași", n: 4 }, text: "<b>Ion Popescu</b> opened “Vila Popescu — Iași” again — 4× total. Worth a call now.", actor: null, days: 1 },
    { kind: "lead",  key: "act_lead_widget",params: { b: "Natalia Cazacu" },                              text: "New lead from the website widget: <b>Natalia Cazacu</b>",       actor: null, days: 2 },
    { kind: "sent",  key: "act_sent",       params: { b: "Casa Sîrbu — Chișinău" },                       text: "Sent <b>Casa Sîrbu — Chișinău</b>",                             actor: sales, days: 5 },
    { kind: "sent",  key: "act_sent",       params: { b: "Hala Industrială — Iași" },                     text: "Sent <b>Hala Industrială — Iași</b>",                           actor: eng,   days: 9 },
    { kind: "won",   key: "act_won",        params: { b: "Pensiunea Bucovina — G. Humorului" },           text: "Marked <b>Pensiunea Bucovina — G. Humorului</b> as won",        actor: owner, days: 22 },
    { kind: "sent",  key: "act_sent",       params: { b: "Fabrica Textil — Bacău" },                      text: "Sent <b>Fabrica Textil — Bacău</b>",                            actor: eng,   days: 18 },
    { kind: "lead",  key: "act_lead_widget",params: { b: "Grigore Cebotari" },                            text: "New lead from the website widget: <b>Grigore Cebotari</b>",     actor: null,  days: 1 },
  ];
  await admin.from("activity").insert(feed.map((f) => ({
    company_id: co.id, kind: f.kind, key: f.key, params: f.params, text: f.text,
    actor_id: f.actor?.id ?? null, actor_name: f.actor?.name ?? "",
    created_at: ago(f.days),
  })));

  return { email: people[0].email, password };
}
