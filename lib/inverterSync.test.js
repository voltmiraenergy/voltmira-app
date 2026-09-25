// Tests for the glue between a portal and VoltMira's tables: which rows a
// sync writes, where, and what it refuses to write. The database is an
// in-memory stand-in for the few Supabase calls lib/inverterSync.js makes, and
// the portal is a fake Growatt; the figures are test data.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { connectAccount, syncConnection, syncAll } from "./inverterSync.js";
import { seal } from "./secretBox.js";

const KEY = crypto.randomBytes(32);
const CO = "co-1";

/** Just enough of the supabase-js query builder for lib/inverterSync.js. */
function fakeDb(seed = {}) {
  const tables = structuredClone(seed);
  let seq = 0;
  function from(name) {
    const rows = (tables[name] ||= []);
    let op = "select", payload = null, conflict = "id", one = null;
    const filters = [];
    const b = {
      select() { return b; },
      order() { return b; },
      eq(col, v) { filters.push((r) => r[col] === v); return b; },
      or() { filters.push((r) => r.project_id != null || r.studio_job_id != null); return b; },   // the only .or() the lib uses
      insert(p) { op = "insert"; payload = p; return b; },
      upsert(p, o) { op = "upsert"; payload = p; conflict = o?.onConflict || "id"; return b; },
      update(p) { op = "update"; payload = p; return b; },
      delete() { op = "delete"; return b; },
      single() { one = "single"; return b; },
      maybeSingle() { one = "maybe"; return b; },
      then(ok, bad) { return Promise.resolve().then(run).then(ok, bad); },
    };
    const match = (r) => filters.every((f) => f(r));
    function run() {
      if (op === "select") {
        const hit = rows.filter(match);
        if (!one) return { data: hit, error: null };
        return { data: hit[0] ?? null, error: one === "single" && !hit[0] ? { message: "no rows" } : null };
      }
      if (op === "insert") {
        const added = [].concat(payload).map((r) => ({ id: `${name}-${++seq}`, ...r }));
        rows.push(...added);
        return { data: one ? added[0] : added, error: null };
      }
      if (op === "upsert") {
        const keys = conflict.split(",");
        for (const r of [].concat(payload)) {
          const ex = rows.find((x) => keys.every((k) => x[k] === r[k]));
          if (ex) Object.assign(ex, r); else rows.push({ id: `${name}-${++seq}`, ...r });
        }
        return { data: null, error: null };
      }
      if (op === "update") { rows.filter(match).forEach((r) => Object.assign(r, payload)); return { data: null, error: null }; }
      if (op === "delete") { tables[name] = rows.filter((r) => !match(r)); return { data: null, error: null }; }
    }
    return b;
  }
  return { from, tables };
}

/** A Growatt that knows two plants and answers monthly energy per plant and year. */
function fakeGrowatt({ token = "good", energy = {} } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    calls.push(u.pathname + u.search);
    if (init.headers?.token !== token) return json({ error_code: 10011, error_msg: "token error" });
    if (u.pathname === "/v1/plant/list") {
      return json({ error_code: 0, data: { count: 2, plants: [
        { plant_id: 11, name: "Ciobanu roof", peak_power: 8 },
        { plant_id: 12, name: "Codru hotel", peak_power: 30 },
      ] } });
    }
    if (u.pathname === "/v1/plant/energy") {
      const id = u.searchParams.get("plant_id");
      const year = u.searchParams.get("start_date").slice(0, 4);
      return json({ error_code: 0, data: { energys: (energy[id] || []).filter((r) => r.date.startsWith(year)) } });
    }
    return new Response("not found", { status: 404 });
  };
  fn.calls = calls;
  return fn;
}
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/* ------------------------------------------------------------- connect ---- */

test("connect: a login the portal rejects is never stored", async () => {
  const db = fakeDb();
  const r = await connectAccount(db, { companyId: CO, provider: "growatt", rawCreds: { token: "wrong" }, key: KEY, fetchImpl: fakeGrowatt() });
  assert.equal(r.error, "portal");
  assert.equal(r.code, "auth");
  assert.equal((db.tables.inverter_connections || []).length, 0);
  assert.equal((db.tables.inverter_secrets || []).length, 0);
});

test("connect: refuses without an encryption key, and names missing fields", async () => {
  const db = fakeDb();
  assert.equal((await connectAccount(db, { companyId: CO, provider: "growatt", rawCreds: { token: "good" }, key: null })).error, "no_secret_key");
  const miss = await connectAccount(db, { companyId: CO, provider: "solarman", rawCreds: { appId: "a" }, key: KEY });
  assert.equal(miss.error, "missing_fields");
  assert.deepEqual(miss.fields, ["appSecret", "login", "password"]);
  assert.equal((await connectAccount(db, { companyId: CO, provider: "sma", rawCreds: {}, key: KEY })).error, "unknown_provider");
});

test("connect: stores the connection, the login only encrypted, and the station list", async () => {
  const db = fakeDb();
  const r = await connectAccount(db, { companyId: CO, userId: "u1", provider: "growatt", label: " Main ", rawCreds: { token: "good" }, key: KEY, fetchImpl: fakeGrowatt() });
  assert.equal(r.error, undefined);
  assert.equal(r.connection.label, "Main");
  assert.equal(r.connection.status, "ok");
  const [secret] = db.tables.inverter_secrets;
  assert.equal(secret.connection_id, r.connection.id);
  assert.ok(!secret.ciphertext.includes("good"), "token must not be stored in clear");
  assert.deepEqual(db.tables.inverter_stations.map((s) => [s.external_id, s.name, s.capacity_kw, s.company_id]),
    [["11", "Ciobanu roof", 8, CO], ["12", "Codru hotel", 30, CO]]);
});

/* ---------------------------------------------------------------- sync ---- */

// 15 Sep 2026: September is still running, August is the last finished month.
const NOW = Date.UTC(2026, 8, 15, 9);

function seededDb({ token = "good", studioExisting } = {}) {
  const conn = { id: "c1", company_id: CO, provider: "growatt", status: "ok", last_sync_at: null, last_error: null };
  return fakeDb({
    inverter_connections: [conn],
    inverter_secrets: [{ connection_id: "c1", ciphertext: seal({ token }, KEY) }],
    inverter_stations: [
      { id: "s1", company_id: CO, connection_id: "c1", external_id: "11", name: "Ciobanu roof", project_id: "p1", studio_job_id: null },
      { id: "s2", company_id: CO, connection_id: "c1", external_id: "12", name: "Codru hotel", project_id: null, studio_job_id: "job-codru" },
    ],
    studio_state: studioExisting ? [{ company_id: CO, key: "voltmira_studio_actuals_job-codru", value: studioExisting }] : [],
    production_readings: [],
  });
}
const ENERGY = {
  11: [{ date: "2025-12", energy: 210.4 }, { date: "2026-07", energy: 1180.26 }, { date: "2026-08", energy: 1102 }, { date: "2026-09", energy: 380 }],
  12: [{ date: "2026-06", energy: 4200 }, { date: "2026-08", energy: 3900.6 }, { date: "2026-09", energy: 1500 }],
};

test("sync: a quote-linked station fills production_readings, finished months only", async () => {
  const db = seededDb();
  const r = await syncConnection(db, db.tables.inverter_connections[0], { key: KEY, fetchImpl: fakeGrowatt({ energy: ENERGY }), now: NOW });
  assert.equal(r.status, "ok");
  assert.equal(r.linked, 2);
  const mine = db.tables.production_readings.filter((x) => x.project_id === "p1").map((x) => [x.month, x.kwh, x.source]).sort();
  assert.deepEqual(mine, [["2025-12-01", 210.4, "growatt"], ["2026-07-01", 1180.3, "growatt"], ["2026-08-01", 1102, "growatt"]]);
  assert.ok(db.tables.production_readings.every((x) => x.company_id === CO));
  // The Studio-only station writes no quote readings.
  assert.equal(db.tables.production_readings.some((x) => x.project_id == null), false);
});

test("sync: a job-linked station fills that job's Studio months and keeps hand-typed ones the portal lacks", async () => {
  const typed = ["", "", "", "", "3100", "", "", "", "", "", "", ""];   // May typed by hand
  const db = seededDb({ studioExisting: typed });
  await syncConnection(db, db.tables.inverter_connections[0], { key: KEY, fetchImpl: fakeGrowatt({ energy: ENERGY }), now: NOW });
  const row = db.tables.studio_state.find((x) => x.key === "voltmira_studio_actuals_job-codru");
  assert.deepEqual(row.value, ["", "", "", "", "3100", "4200", "", "3901", "", "", "", ""]);   // Sep is running: not written
  assert.equal(row.company_id, CO);
});

test("sync: records the last month on each station and the outcome on the account", async () => {
  const db = seededDb();
  await syncConnection(db, db.tables.inverter_connections[0], { key: KEY, fetchImpl: fakeGrowatt({ energy: ENERGY }), now: NOW });
  const s1 = db.tables.inverter_stations.find((s) => s.id === "s1");
  assert.equal(s1.last_month, "2026-08-01");
  assert.equal(s1.last_kwh, 1102);
  assert.equal(s1.last_error, null);
  const c = db.tables.inverter_connections[0];
  assert.equal(c.status, "ok");
  assert.equal(c.last_error_code, null);
  assert.equal(c.last_sync_at, new Date(NOW).toISOString());
});

test("sync: unlinked stations are listed but their figures aren't fetched", async () => {
  const db = seededDb();
  db.tables.inverter_stations.forEach((s) => { s.project_id = null; s.studio_job_id = null; });
  const f = fakeGrowatt({ energy: ENERGY });
  const r = await syncConnection(db, db.tables.inverter_connections[0], { key: KEY, fetchImpl: f, now: NOW });
  assert.equal(r.status, "ok");
  assert.equal(r.linked, 0);
  assert.equal(f.calls.some((c) => c.startsWith("/v1/plant/energy")), false);
  assert.equal(db.tables.production_readings.length, 0);
});

test("sync: a revoked token marks the account failed and writes nothing", async () => {
  const db = seededDb({ token: "revoked" });
  const r = await syncConnection(db, db.tables.inverter_connections[0], { key: KEY, fetchImpl: fakeGrowatt({ energy: ENERGY }), now: NOW });
  assert.equal(r.status, "error");
  assert.match(r.error, /token/i);
  assert.equal(r.code, "auth");
  assert.equal(db.tables.inverter_connections[0].status, "error");
  assert.equal(db.tables.inverter_connections[0].last_error_code, "auth");
  assert.equal(db.tables.production_readings.length, 0);
});

test("sync: a changed encryption key is reported, not crashed on", async () => {
  const db = seededDb();
  const r = await syncConnection(db, db.tables.inverter_connections[0], { key: crypto.randomBytes(32), fetchImpl: fakeGrowatt(), now: NOW });
  assert.equal(r.status, "error");
  assert.match(r.error, /encryption key/);
  assert.equal(r.code, "key_changed");
});

test("syncAll goes through every account, oldest sync first", async () => {
  const db = seededDb();
  db.tables.inverter_connections.push({ id: "c2", company_id: "co-2", provider: "growatt", last_sync_at: "2026-09-01T00:00:00Z" });
  db.tables.inverter_secrets.push({ connection_id: "c2", ciphertext: seal({ token: "good" }, KEY) });
  const out = await syncAll(db, { key: KEY, fetchImpl: fakeGrowatt({ energy: ENERGY }) });
  assert.deepEqual(out.results.map((x) => x.id).sort(), ["c1", "c2"]);
  assert.ok(out.results.every((x) => x.status === "ok"));
});
