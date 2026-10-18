import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { saveProfile, attachDoc, requestVerification, decideVerification, loadProfile } from "./profileFlow.js";

const RAIONS = ["ialoveni", "chisinau", "balti"];
const CO = { id: "C1", name: "SolarTech Chișinău SRL" };
const FORM = { regions: ["ialoveni", "chisinau"], min_kw: 3, max_kw: 30, sla_hours: 24, licence_no: "ANRE-123", licence_valid_to: "2027-06-30", insurer: "Moldasig", insurance_valid_to: "2027-03-31", published: true };
const db0 = () => fakeDb({ installer_profiles: [{ company_id: "C9", slug: "solartech-chisinau" }], audit_log: [] }, { installer_profiles: [["company_id"]] });
const storage = () => { const files = []; return { files, from: () => ({ upload: async (path, bytes) => { files.push(path); return { data: { path } }; } }) }; };
const pdf = { bytes: new Uint8Array([37, 80, 68, 70]), mime: "application/pdf" };
const A = { id: "U1", email: "owner@st.md" };

test("profile, documents, a check asked for, verified; a later change to a checked field asks again", async () => {
  const db = db0(); const st = storage();
  const s = await saveProfile(db, { company: CO, input: FORM, raionIds: RAIONS, actor: A });
  assert.equal(s.ok, true);
  assert.equal(s.profile.slug, "solartech-chisinau-2", "the public name is free of the other installer's");
  assert.deepEqual((await requestVerification(db, { companyId: "C1", actor: A })).missing, ["licence_doc", "insurance_doc"]);
  assert.equal((await attachDoc(db, st, { companyId: "C1", kind: "licence", file: pdf, actor: A })).ok, true);
  assert.equal((await attachDoc(db, st, { companyId: "C1", kind: "insurance", file: pdf, actor: A })).ok, true);
  assert.match(st.files[0], /^C1\/licence-\d+\.pdf$/);
  assert.equal((await requestVerification(db, { companyId: "C1", actor: A })).ok, true);
  assert.equal((await loadProfile(db, "C1")).profile.verification, "pending");
  assert.equal((await decideVerification(db, { companyId: "C1", decision: "verified", admin: { email: "admin@voltmira.com" } })).ok, true);
  const v = (await loadProfile(db, "C1")).profile;
  assert.equal(v.verification, "verified");
  assert.equal(v.verified_by, "admin@voltmira.com");
  // the about text: still verified
  await saveProfile(db, { company: CO, input: { ...FORM, about: "Din 2015" }, raionIds: RAIONS, actor: A });
  assert.equal((await loadProfile(db, "C1")).profile.verification, "verified");
  // a new insurance date: checked again
  await saveProfile(db, { company: CO, input: { ...FORM, insurance_valid_to: "2028-03-31" }, raionIds: RAIONS, actor: A });
  assert.equal((await loadProfile(db, "C1")).profile.verification, "pending");
  assert.ok(db.T.audit_log.some((a) => a.action === "profile.verify_decision"));
  assert.equal(db.T.audit_log.filter((a) => a.action === "profile.update").length, 2, "the first save and the insurance change, not the text");
});

test("profile: what is refused", async () => {
  const db = db0(); const st = storage();
  assert.deepEqual((await saveProfile(db, { company: CO, input: { ...FORM, max_kw: 1 }, raionIds: RAIONS })).fields, ["max_kw"]);
  assert.equal((await attachDoc(db, st, { companyId: "C1", kind: "licence", file: pdf })).error, "save_profile_first");
  await saveProfile(db, { company: CO, input: FORM, raionIds: RAIONS });
  assert.equal((await attachDoc(db, st, { companyId: "C1", kind: "licence", file: { bytes: pdf.bytes, mime: "text/html" } })).error, "type");
  assert.equal((await attachDoc(db, st, { companyId: "C1", kind: "passport", file: pdf })).error, "kind");
  assert.equal((await attachDoc(db, st, { companyId: "C1", kind: "licence", file: { bytes: new Uint8Array(0), mime: "application/pdf" } })).error, "size");
  assert.equal((await decideVerification(db, { companyId: "C1", decision: "verified", admin: {} })).error, "incomplete", "nothing is verified without the documents");
  assert.equal((await decideVerification(db, { companyId: "C1", decision: "maybe" })).error, "decision");
  assert.equal((await saveProfile(fakeDb({ audit_log: [] }), { company: CO, input: FORM, raionIds: RAIONS })).error, "needs_db");
});
