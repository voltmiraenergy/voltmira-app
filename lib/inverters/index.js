// lib/inverters/index.js — the inverter portals VoltMira can read, and the
// pure rules for turning their monthly figures into stored readings.
// Server-only (the connectors use node:crypto). I/O lives in lib/inverterSync.js.
import { createFusionSolar } from "./fusionsolar.js";
import { createSolarman } from "./solarman.js";
import { createGrowatt } from "./growatt.js";
export { PortalError } from "./common.js";

// `fields` drives the connect form (labels are i18n keys); `secret` fields are
// never sent back to the browser; `login` is shown masked so a connection can
// be recognised.
export const PROVIDERS = {
  fusionsolar: {
    source: "fusionsolar",
    fields: [
      { key: "domain", label: "inv_f_domain", placeholder: "eu5.fusionsolar.huawei.com" },
      { key: "userName", label: "inv_f_api_user" },
      { key: "systemCode", label: "inv_f_api_password", secret: true },
    ],
    login: "userName",
    create: createFusionSolar,
  },
  solarman: {
    source: "solarman",
    fields: [
      { key: "appId", label: "inv_f_app_id" },
      { key: "appSecret", label: "inv_f_app_secret", secret: true },
      { key: "login", label: "inv_f_login" },
      { key: "password", label: "inv_f_password", secret: true },
    ],
    login: "login",
    create: createSolarman,
  },
  growatt: {
    source: "growatt",
    fields: [{ key: "token", label: "inv_f_token", secret: true }],
    login: null,
    create: createGrowatt,
  },
};

/** Keep only the provider's own fields, trimmed; report any that are missing. */
export function cleanCreds(provider, raw) {
  const def = PROVIDERS[provider];
  if (!def) return { creds: null, missing: ["provider"] };
  const creds = {};
  const missing = [];
  for (const f of def.fields) {
    const v = String(raw?.[f.key] ?? "").trim().slice(0, 300);
    if (!v) missing.push(f.key);
    creds[f.key] = v;
  }
  return { creds, missing };
}

/** Portal rows limited to months that are over: the running month is partial. */
export function completeMonths(rows, currentMonthKey) {
  return (rows || []).filter((r) => r && /^\d{4}-\d{2}$/.test(r.month) && r.month < currentMonthKey && r.kwh != null);
}

/** Rows for production_readings (unique per project and month). */
export function toProductionRows({ companyId, projectId, source, rows }) {
  return rows.map((r) => ({
    company_id: companyId, project_id: projectId, month: r.month + "-01",
    kwh: Math.round(r.kwh * 10) / 10, source,
  }));
}

/**
 * A Studio job's monitoring data is twelve strings for one calendar year
 * (what the Monitoring step's inputs hold). Portal figures fill the months
 * they cover; anything else already typed in is left as it was.
 */
export function mergeStudioActuals(existing, rows, year) {
  const out = Array.from({ length: 12 }, (_, i) => (Array.isArray(existing) && existing[i] != null ? String(existing[i]) : ""));
  for (const r of rows || []) {
    if (!r.month.startsWith(String(year))) continue;
    const i = Number(r.month.slice(5, 7)) - 1;
    if (i >= 0 && i < 12) out[i] = String(Math.round(r.kwh));
  }
  return out;
}
