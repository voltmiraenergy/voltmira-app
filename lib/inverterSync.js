// lib/inverterSync.js — connect an inverter-portal account and pull its
// monthly production into VoltMira. Server-only; every function takes the
// service-role client and is called only after the route has checked the
// caller's company and role (app/api/inverters/*).
//
// Where the readings go:
//   a station linked to a quote       -> production_readings, which the
//                                        dashboard's system health and the
//                                        editor's yield calibration read
//   a station linked to a Studio job  -> that job's monitoring months
//                                        (studio_state), which the fleet
//                                        monitor assesses with lib/fleetHealth.js
// Only months that are over are written; a month the portal has no figure
// for is left alone, never stored as zero.
import { open, seal, maskLogin } from "./secretBox.js";
import { PROVIDERS, PortalError, cleanCreds, completeMonths, toProductionRows, mergeStudioActuals } from "./inverters/index.js";
import { mdMonthKey } from "./tz.js";

const STATION_COLS = "id, company_id, connection_id, external_id, name, capacity_kw, project_id, studio_job_id, last_month, last_kwh, last_error, last_error_code, updated_at";

export const isMissingTable = (e) =>
  e?.code === "42P01" || e?.code === "PGRST205" || /inverter_|does not exist|schema cache/i.test(e?.message || "");

function portalMessage(e) {
  if (e instanceof PortalError) return e.message;
  return "Unexpected error while reading the portal.";
}
// Stored next to the English message so the app can say it in the user's language.
const portalCode = (e) => (e instanceof PortalError ? e.code : "unknown");

async function saveStations(admin, companyId, connectionId, stations) {
  if (!stations.length) return;
  const now = new Date().toISOString();
  const { error } = await admin.from("inverter_stations").upsert(
    stations.map((s) => ({
      company_id: companyId, connection_id: connectionId, external_id: s.id,
      name: s.name.slice(0, 200), capacity_kw: s.capacityKw, updated_at: now,
    })),
    { onConflict: "connection_id,external_id" }   // links (project_id / studio_job_id) are left as they are
  );
  if (error) throw error;
}

/**
 * Check a login against the portal and store it. The account is only saved
 * once the portal has actually accepted it and listed its stations.
 * @returns {{ connection?, stations?, error?, fields? }}
 */
export async function connectAccount(admin, { companyId, userId, provider, label, rawCreds, key, fetchImpl = fetch }) {
  const def = PROVIDERS[provider];
  if (!def) return { error: "unknown_provider" };
  if (!key) return { error: "no_secret_key" };
  const { creds, missing } = cleanCreds(provider, rawCreds);
  if (missing.length) return { error: "missing_fields", fields: missing };

  let stations;
  try {
    stations = await def.create(creds, fetchImpl).listStations();
  } catch (e) {
    return { error: "portal", message: portalMessage(e), code: e?.code };
  }

  const { data: conn, error } = await admin.from("inverter_connections").insert({
    company_id: companyId, provider, label: String(label || "").trim().slice(0, 80),
    account_hint: def.login ? maskLogin(creds[def.login]) : "", status: "ok",
    last_sync_at: null, created_by: userId || null,
  }).select("id, provider, label, account_hint, status, last_sync_at, last_error, last_error_code, created_at").single();
  if (error) return { error: isMissingTable(error) ? "not_migrated" : "db", message: error.message };

  const { error: e2 } = await admin.from("inverter_secrets").insert({ connection_id: conn.id, ciphertext: seal(creds, key) });
  if (e2) {
    // Never leave a connection without its credentials behind.
    await admin.from("inverter_connections").delete().eq("id", conn.id);
    return { error: "db", message: e2.message };
  }
  await saveStations(admin, companyId, conn.id, stations);
  return { connection: conn, stations };
}

/**
 * Refresh one account: station list, then monthly figures for every linked
 * station, this year and last. Records the outcome on the connection and on
 * each station, so a failure is visible rather than silent.
 */
export async function syncConnection(admin, conn, { key, fetchImpl = fetch, now = Date.now() } = {}) {
  const summary = { stations: 0, linked: 0, readings: 0, errors: [] };
  const finish = async (status, lastError, code = null) => {
    await admin.from("inverter_connections")
      .update({ status, last_error: lastError, last_error_code: code, last_sync_at: new Date(now).toISOString() }).eq("id", conn.id);
    return { ...summary, status, error: lastError, code };
  };

  let creds;
  try {
    const { data: sec, error } = await admin.from("inverter_secrets").select("ciphertext").eq("connection_id", conn.id).single();
    if (error || !sec) return finish("error", "The saved login for this account is missing. Remove it and connect again.", "secret_missing");
    creds = open(sec.ciphertext, key);
  } catch {
    return finish("error", "The saved login can't be read on this server (the encryption key changed). Connect the account again.", "key_changed");
  }

  const def = PROVIDERS[conn.provider];
  let client;
  try {
    client = def.create(creds, fetchImpl);
    const stations = await client.listStations();
    summary.stations = stations.length;
    await saveStations(admin, conn.company_id, conn.id, stations);
  } catch (e) {
    return finish("error", portalMessage(e), portalCode(e));
  }

  const { data: linked } = await admin.from("inverter_stations").select(STATION_COLS)
    .eq("connection_id", conn.id).or("project_id.not.is.null,studio_job_id.not.is.null");
  summary.linked = (linked || []).length;
  if (!summary.linked) return finish("ok", null);

  const current = mdMonthKey(now);                 // "YYYY-MM", app time zone
  const year = Number(current.slice(0, 4));
  const byStation = new Map();
  try {
    for (const y of [year - 1, year]) {
      const got = await client.monthly(linked.map((s) => s.external_id), y);
      for (const [id, rows] of got) byStation.set(id, [...(byStation.get(id) || []), ...rows]);
    }
  } catch (e) {
    return finish("error", portalMessage(e), portalCode(e));
  }

  for (const st of linked) {
    const rows = completeMonths(byStation.get(st.external_id), current);
    let stError = null, stCode = null;
    try {
      if (st.project_id && rows.length) {
        const { error } = await admin.from("production_readings")
          .upsert(toProductionRows({ companyId: conn.company_id, projectId: st.project_id, source: def.source, rows }),
            { onConflict: "project_id,month" });
        if (error) throw error;
      }
      if (st.studio_job_id && rows.length) {
        const keyName = "voltmira_studio_actuals_" + st.studio_job_id;
        const { data: cur, error: e1 } = await admin.from("studio_state").select("value")
          .eq("company_id", conn.company_id).eq("key", keyName).maybeSingle();
        if (e1) throw e1;
        const merged = mergeStudioActuals(cur?.value, rows, year);
        const { error: e2 } = await admin.from("studio_state").upsert(
          { company_id: conn.company_id, key: keyName, value: merged, updated_at: new Date(now).toISOString() },
          { onConflict: "company_id,key" });
        if (e2) throw e2;
      }
      summary.readings += rows.length;
    } catch (e) {
      stCode = /studio_state/.test(e?.message || "") ? "studio_not_ready" : "store_failed";
      stError = stCode === "studio_not_ready"
        ? "Studio isn't saving to the workspace yet, so this job's months couldn't be filled."
        : "Couldn't store this station's readings.";
      summary.errors.push({ station: st.name, error: stError, code: stCode });
    }
    const last = rows.length ? rows.reduce((a, b) => (a.month > b.month ? a : b)) : null;
    await admin.from("inverter_stations").update({
      last_error: stError,
      last_error_code: stCode,
      ...(last ? { last_month: last.month + "-01", last_kwh: Math.round(last.kwh * 10) / 10 } : {}),
      updated_at: new Date(now).toISOString(),
    }).eq("id", st.id);
  }
  const first = summary.errors[0];
  return finish(first ? "error" : "ok", first?.error ?? null, first?.code ?? null);
}

/** The nightly job: every account of every company, one at a time, within a time budget. */
export async function syncAll(admin, { key, fetchImpl = fetch, budgetMs = 50_000 } = {}) {
  const started = Date.now();
  const { data: conns, error } = await admin.from("inverter_connections")
    .select("id, company_id, provider").order("last_sync_at", { ascending: true, nullsFirst: true });
  if (error) return { error: isMissingTable(error) ? "not_migrated" : error.message, done: 0 };
  const results = [];
  for (const c of conns || []) {
    if (Date.now() - started > budgetMs) break;   // the rest go first next time (oldest sync first)
    results.push({ id: c.id, ...(await syncConnection(admin, c, { key, fetchImpl })) });
  }
  return { done: results.length, total: (conns || []).length, results };
}
