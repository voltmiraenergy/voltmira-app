// Connector tests run the whole login -> stations -> monthly flow against a
// fake fetch that answers in the shapes each vendor documents. The fixtures
// below are test data, not readings from a real system.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createFusionSolar, parseFusionMonths, monthOfCollectTime, validFusionHost } from "./inverters/fusionsolar.js";
import { createSolarman, parseSolarmanMonths } from "./inverters/solarman.js";
import { createGrowatt, parseGrowattMonths } from "./inverters/growatt.js";
import { cleanCreds, completeMonths, toProductionRows, mergeStudioActuals } from "./inverters/index.js";

/** A fake fetch that routes by path and records what was sent. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, search: u.search, init });
    const route = routes[u.pathname];
    if (!route) return new Response("not found", { status: 404 });
    const { body, headers = {}, status = 200 } = route(u, init, calls);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  };
  fn.calls = calls;
  return fn;
}

/* ------------------------------------------------------------ FusionSolar */

test("FusionSolar only talks to Huawei's own hosts", () => {
  assert.equal(validFusionHost("eu5.fusionsolar.huawei.com"), true);
  assert.equal(validFusionHost("evil.example.com"), false);
  assert.equal(validFusionHost("eu5.fusionsolar.huawei.com.evil.io"), false);
  assert.throws(() => createFusionSolar({ domain: "169.254.169.254", userName: "a", systemCode: "b" }), /FusionSolar host/);
});

test("FusionSolar months are read in the station's own time zone", () => {
  // 2026-01-01T00:00 in Chisinau (+02:00) is 2025-12-31T22:00Z.
  assert.equal(monthOfCollectTime(Date.UTC(2025, 11, 31, 22)), "2026-01");
  assert.equal(monthOfCollectTime(Date.UTC(2026, 5, 30, 21)), "2026-07");
});

test("FusionSolar: log in, list stations, read monthly yield; gaps stay gaps", async () => {
  let logins = 0;
  const f = fakeFetch({
    "/thirdData/login": () => { logins++; return { body: { success: true, failCode: 0 }, headers: { "xsrf-token": "tok-" + logins } }; },
    "/thirdData/stations": (u, init) => {
      assert.equal(init.headers["XSRF-TOKEN"], "tok-1");
      return { body: { success: true, data: { pageCount: 1, list: [{ plantCode: "NE=1", plantName: "Rusu", capacity: 6.5 }] } } };
    },
    "/thirdData/getKpiStationMonth": (u, init) => {
      assert.deepEqual(JSON.parse(init.body).stationCodes, "NE=1");
      return { body: { success: true, data: [
        { stationCode: "NE=1", collectTime: Date.UTC(2025, 11, 31, 22), dataItemMap: { PVYield: 310.5 } },
        { stationCode: "NE=1", collectTime: Date.UTC(2026, 0, 31, 22), dataItemMap: { inverter_power: 402 } },
        { stationCode: "NE=1", collectTime: Date.UTC(2026, 1, 28, 22), dataItemMap: { PVYield: null } },
      ] } };
    },
  });
  const c = createFusionSolar({ domain: "eu5.fusionsolar.huawei.com", userName: "api", systemCode: "pw" }, f);
  assert.deepEqual(await c.listStations(), [{ id: "NE=1", name: "Rusu", capacityKw: 6.5 }]);
  const m = await c.monthly(["NE=1"], 2026);
  assert.deepEqual(m.get("NE=1"), [{ month: "2026-01", kwh: 310.5 }, { month: "2026-02", kwh: 402 }]);
  assert.equal(logins, 1);
});

test("FusionSolar logs in again once when the session expires", async () => {
  let logins = 0, first = true;
  const f = fakeFetch({
    "/thirdData/login": () => { logins++; return { body: { success: true }, headers: { "xsrf-token": "t" + logins } }; },
    "/thirdData/stations": () => {
      if (first) { first = false; return { body: { success: false, failCode: 305 } }; }
      return { body: { success: true, data: { pageCount: 1, list: [] } } };
    },
  });
  await createFusionSolar({ domain: "eu5.fusionsolar.huawei.com", userName: "a", systemCode: "b" }, f).listStations();
  assert.equal(logins, 2);
});

test("FusionSolar's rate limit is reported, not retried in a loop", async () => {
  const f = fakeFetch({
    "/thirdData/login": () => ({ body: { success: true }, headers: { "xsrf-token": "t" } }),
    "/thirdData/stations": () => ({ body: { success: false, failCode: 407 } }),
  });
  await assert.rejects(createFusionSolar({ domain: "eu5.fusionsolar.huawei.com", userName: "a", systemCode: "b" }, f).listStations(),
    (e) => e.code === "rate_limited");
});

test("a rejected FusionSolar login is an auth error", async () => {
  const f = fakeFetch({ "/thirdData/login": () => ({ body: { success: false, failCode: 20001 } }) });
  await assert.rejects(createFusionSolar({ domain: "eu5.fusionsolar.huawei.com", userName: "a", systemCode: "b" }, f).listStations(),
    (e) => e.code === "auth");
});

test("parseFusionMonths ignores rows without a station or a time", () => {
  assert.equal(parseFusionMonths({ success: true, data: [{ dataItemMap: { PVYield: 1 } }] }).size, 0);
  assert.equal(parseFusionMonths({ success: false }).size, 0);
});

/* ------------------------------------------------------------ Solarman */

test("Solarman: token with a hashed password, stations, then monthly history", async () => {
  const f = fakeFetch({
    "/account/v1.0/token": (u, init) => {
      assert.equal(u.searchParams.get("appId"), "app-1");
      const b = JSON.parse(init.body);
      assert.equal(b.email, "ion@example.com");
      assert.equal(b.password, crypto.createHash("sha256").update("pw").digest("hex"));
      return { body: { access_token: "AT", success: true } };
    },
    "/station/v1.0/list": (u, init) => {
      assert.equal(init.headers.Authorization, "bearer AT");
      return { body: { success: true, total: 1, stationList: [{ id: 555, name: "Popescu", installedCapacity: 8.5 }] } };
    },
    "/station/v1.0/history": (u, init) => {
      const b = JSON.parse(init.body);
      assert.deepEqual([b.stationId, b.timeType, b.startTime, b.endTime], [555, 3, "2026-01", "2026-12"]);
      return { body: { success: true, stationDataItems: [
        { year: 2026, month: 1, generationValue: 280.4 },
        { year: 2026, month: 2, generationValue: null },
        { year: 2025, month: 12, generationValue: 190 },
      ] } };
    },
  });
  const c = createSolarman({ appId: "app-1", appSecret: "sec", login: "ion@example.com", password: "pw" }, f);
  assert.deepEqual(await c.listStations(), [{ id: "555", name: "Popescu", capacityKw: 8.5 }]);
  assert.deepEqual((await c.monthly(["555"], 2026)).get("555"), [{ month: "2026-01", kwh: 280.4 }]);
});

test("a refused Solarman login is an auth error with the portal's reason", async () => {
  const f = fakeFetch({ "/account/v1.0/token": () => ({ body: { success: false, msg: "appId invalid" } }) });
  await assert.rejects(createSolarman({ appId: "x", appSecret: "y", login: "u", password: "p" }, f).listStations(),
    (e) => e.code === "auth" && /appId invalid/.test(e.message));
});

test("parseSolarmanMonths keeps only the asked year and real numbers", () => {
  assert.deepEqual(parseSolarmanMonths({ stationDataItems: [{ year: 2026, month: 13, generationValue: 1 }] }, 2026), []);
});

/* ------------------------------------------------------------ Growatt */

test("Growatt: token header, plants, monthly energy", async () => {
  const f = fakeFetch({
    "/v1/plant/list": (u, init) => {
      assert.equal(init.headers.token, "gt");
      return { body: { error_code: 0, data: { count: 1, plants: [{ plant_id: 42, name: "AgroNord", peak_power: 300 }] } } };
    },
    "/v1/plant/energy": (u) => {
      assert.equal(u.searchParams.get("time_unit"), "month");
      return { body: { error_code: 0, data: { energys: [{ date: "2026-01", energy: "18250.5" }, { date: "2026-02", energy: "" }] } } };
    },
  });
  const c = createGrowatt({ token: "gt" }, f);
  assert.deepEqual(await c.listStations(), [{ id: "42", name: "AgroNord", capacityKw: 300 }]);
  assert.deepEqual((await c.monthly(["42"], 2026)).get("42"), [{ month: "2026-01", kwh: 18250.5 }]);
});

test("a rejected Growatt token is an auth error", async () => {
  const f = fakeFetch({ "/v1/plant/list": () => ({ body: { error_code: 10011, error_msg: "token error" } }) });
  await assert.rejects(createGrowatt({ token: "bad" }, f).listStations(), (e) => e.code === "auth");
});

test("parseGrowattMonths drops malformed dates", () => {
  assert.deepEqual(parseGrowattMonths({ error_code: 0, data: { energys: [{ date: "garbage", energy: "5" }] } }, 2026), []);
});

/* ------------------------------------------------------------ shared rules */

test("credentials keep only the provider's own fields and report what is missing", () => {
  const { creds, missing } = cleanCreds("growatt", { token: "  abc  ", extra: "dropped" });
  assert.deepEqual(creds, { token: "abc" });
  assert.deepEqual(missing, []);
  assert.deepEqual(cleanCreds("solarman", { appId: "a" }).missing, ["appSecret", "login", "password"]);
  assert.deepEqual(cleanCreds("nope", {}).missing, ["provider"]);
});

test("only months that are over are stored", () => {
  const rows = [{ month: "2026-08", kwh: 500 }, { month: "2026-09", kwh: 120 }];
  assert.deepEqual(completeMonths(rows, "2026-09"), [{ month: "2026-08", kwh: 500 }]);
});

test("readings become one production row per project and month", () => {
  assert.deepEqual(toProductionRows({ companyId: "c", projectId: "p", source: "growatt", rows: [{ month: "2026-08", kwh: 500.26 }] }),
    [{ company_id: "c", project_id: "p", month: "2026-08-01", kwh: 500.3, source: "growatt" }]);
});

test("portal figures fill a Studio job's months without wiping hand-typed ones", () => {
  const typed = ["100", "", "", "", "", "", "", "", "", "", "", ""];
  const merged = mergeStudioActuals(typed, [{ month: "2026-02", kwh: 210.6 }, { month: "2025-12", kwh: 9 }], 2026);
  assert.deepEqual(merged.slice(0, 3), ["100", "211", ""]);
  assert.equal(merged.length, 12);
});
