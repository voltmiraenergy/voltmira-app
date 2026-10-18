import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { linkHomeowner, loginLink, submitReview, homeownerProjects, enterUrl } from "./homeownerFlow.js";

// a stand-in for supabase.auth.admin
function fakeAuth(users = []) {
  const U = users.map((u) => ({ ...u }));
  return {
    U,
    async createUser({ email, app_metadata }) {
      if (U.some((u) => u.email === email)) return { error: { message: "A user with this email address has already been registered" } };
      U.push({ id: `u-${U.length + 1}`, email, app_metadata }); return { data: { user: U[U.length - 1] } };
    },
    async generateLink({ email }) {
      const user = U.find((u) => u.email === email);
      return user ? { data: { user: { ...user }, properties: { hashed_token: `h-${user.id}`, verification_type: "magiclink" } } } : { error: { message: "not found" } };
    },
    async updateUserById(id, { app_metadata }) { Object.assign(U.find((u) => u.id === id), { app_metadata }); return { data: {} }; },
  };
}
const io = (auth) => {
  const mail = [];
  return { mail, io: { auth, emailConfigured: () => true, emailHtml: (lang, v) => ({ subject: `S-${lang}`, html: v.url }), sendEmail: async (m) => { mail.push(m); return { sent: true }; } } };
};
const PROJECT = { id: "P1", company_id: "C1", client_email: "Ion@X.md", client_name: "Ion Popescu", address: "str. Mare 1, Ialoveni", install_progress: {} };
const db0 = (over = {}) => fakeDb({ homeowner_links: [], profiles: [{ id: "inst-1" }], projects: [structuredClone(PROJECT)], reviews: [], companies: [{ id: "C1", name: "SolarTech", lang: "ro" }], audit_log: [], ...over },
  { homeowner_links: [["user_id", "project_id"]], reviews: [["project_id"]] });

test("claim from the signed offer: only the email the quote has; a homeowner account, a link, an email", async () => {
  const db = db0(); const auth = fakeAuth(); const { mail, io: x } = io(auth);
  const wrong = await linkHomeowner(db, { project: PROJECT, email: "someone@else.md", via: "claim", base: "https://app.test", io: x });
  assert.deepEqual(wrong, { ok: true, silent: true }, "the same calm answer, and nothing done");
  assert.equal(db.T.homeowner_links.length, 0);
  const r = await linkHomeowner(db, { project: PROJECT, email: " ION@x.md ", via: "claim", base: "https://app.test/", lang: "ro", io: x });
  assert.deepEqual(r, { ok: true, sent: true });
  assert.equal(auth.U[0].app_metadata.role, "homeowner");
  assert.deepEqual(db.T.homeowner_links.map((l) => [l.user_id, l.project_id, l.email, l.via]), [["u-1", "P1", "ion@x.md", "claim"]]);
  assert.equal(mail[0].html, "https://app.test/home/enter?th=h-u-1&t=magiclink");
  // twice: still one link, a fresh email
  await linkHomeowner(db, { project: PROJECT, email: "ion@x.md", via: "claim", base: "https://app.test", io: x });
  assert.equal(db.T.homeowner_links.length, 1);
  assert.equal(mail.length, 2);
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["homeowner.link"]);
});

test("an installer's email never becomes a homeowner; a bad email is refused; invites ignore the quote's email", async () => {
  const db = db0(); const auth = fakeAuth([{ id: "inst-1", email: "boss@solar.md", app_metadata: {} }]); const { io: x } = io(auth);
  assert.equal((await linkHomeowner(db, { project: { ...PROJECT, client_email: "boss@solar.md" }, email: "boss@solar.md", via: "claim", base: "x", io: x })).error, "installer_account");
  assert.equal(auth.U[0].app_metadata.role, undefined);
  assert.equal((await linkHomeowner(db, { project: PROJECT, email: "nope", via: "invite", base: "x", io: x })).error, "email");
  const inv = await linkHomeowner(db, { project: PROJECT, email: "wife@x.md", via: "invite", base: "x", io: x });
  assert.equal(inv.ok, true);
  assert.equal(db.T.homeowner_links[0].via, "invite");
});

test("sign in again: a link only for a linked email, the same answer otherwise", async () => {
  const db = db0({ homeowner_links: [{ user_id: "u-1", project_id: "P1", company_id: "C1", email: "ion@x.md" }] });
  const auth = fakeAuth([{ id: "u-1", email: "ion@x.md", app_metadata: { role: "homeowner" } }]); const { mail, io: x } = io(auth);
  assert.deepEqual(await loginLink(db, { email: "stranger@x.md", base: "https://a", io: x }), { ok: true });
  assert.equal(mail.length, 0);
  assert.deepEqual(await loginLink(db, { email: "ION@x.md", base: "https://a", io: x }), { ok: true });
  assert.equal(mail[0].subject, "S-ro");
  assert.equal((await homeownerProjects(db, "u-1")).links.length, 1);
  assert.equal((await homeownerProjects(fakeDb({}), "u-1")).needsDb, true);
  assert.equal(enterUrl("https://a/", "x y"), "https://a/home/enter?th=x%20y&t=magiclink");
});

test("a rating: only from the linked homeowner, once, after commissioning", async () => {
  const db = db0({ homeowner_links: [{ user_id: "u-1", project_id: "P1", company_id: "C1", email: "ion@x.md" }] });
  assert.equal((await submitReview(db, { userId: "u-1", projectId: "P1", rating: 5 })).error, "not_commissioned");
  db.T.projects[0].install_progress = { commission: "2026-09-01" };
  assert.equal((await submitReview(db, { userId: "u-2", projectId: "P1", rating: 5 })).error, "not_linked");
  assert.equal((await submitReview(db, { userId: "u-1", projectId: "P1", rating: 9 })).error, "rating");
  const ok = await submitReview(db, { userId: "u-1", projectId: "P1", rating: 4.6, body: " Bun " });
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.review.rating, ok.review.body, ok.review.author], [5, "Bun", "Ion P., Ialoveni"]);
  assert.equal((await submitReview(db, { userId: "u-1", projectId: "P1", rating: 3 })).error, "already");
});

test("warranties: the installer's, then each maker's published one, from commissioning", async () => {
  const { addYears, warrantyList } = await import("./homeData.js");
  assert.equal(addYears("2026-09-01", 10), "2036-09-01");
  assert.equal(addYears("2028-02-29", 1), "2029-02-28");
  assert.equal(addYears(null, 5), null);
  const lookup = (b, m) => (m === "Hi-MO 6" ? { warrantyYears: 15, productUrl: "https://x" } : null);
  const w = warrantyList({
    bom: [{ kind: "panel", brand: "LONGi", model: "Hi-MO 6" }, { kind: "panel", brand: "LONGi", model: "Hi-MO 6" }, { kind: "inverter", brand: "Unknown", model: "Z1" }, { kind: "mounting" }],
    installYears: 5, commissionedAt: "2026-09-01", lookup,
  });
  assert.deepEqual(w.map((x) => [x.kind, x.label, x.years, x.until]), [["install", "", 5, "2031-09-01"], ["panel", "LONGi Hi-MO 6", 15, "2041-09-01"]]);
  assert.deepEqual(warrantyList({ bom: [], installYears: null, lookup }), []);
});

test("before the SQL runs, no sign-in account is made", async () => {
  const auth = fakeAuth(); const { io: x } = io(auth);
  const r = await linkHomeowner(fakeDb({ profiles: [], audit_log: [] }), { project: PROJECT, email: "ion@x.md", via: "claim", base: "x", io: x });
  assert.equal(r.error, "needs_db");
  assert.equal(auth.U.length, 0);
});
