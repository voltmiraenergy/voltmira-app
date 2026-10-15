// app/api/inverters/route.js — the company's inverter-portal accounts.
//   GET   accounts, their stations, and the quotes a station can be linked to
//   POST  connect an account: { provider, label, credentials }
// Credentials are checked against the portal first and stored encrypted
// (lib/secretBox.js); they never come back out of this route.
import { NextResponse } from "next/server";
import { caller } from "./_caller.js";
import { keyFromEnv } from "../../../lib/secretBox.js";
import { PROVIDERS } from "../../../lib/inverters/index.js";
import { connectAccount, isMissingTable } from "../../../lib/inverterSync.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";

export const dynamic = "force-dynamic";

// Field definitions for the connect form, without anything secret.
const providerDefs = () => Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, {
  fields: v.fields.map((f) => ({ key: f.key, label: f.label, placeholder: f.placeholder || "", secret: !!f.secret })),
}]));

export async function GET() {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { admin, companyId } = me;

  const [conns, stations, projects] = await Promise.all([
    admin.from("inverter_connections").select("id, provider, label, account_hint, status, last_sync_at, last_error, last_error_code, created_at")
      .eq("company_id", companyId).order("created_at"),
    admin.from("inverter_stations").select("id, connection_id, external_id, name, capacity_kw, project_id, studio_job_id, last_month, last_kwh, last_error, last_error_code")
      .eq("company_id", companyId).order("name"),
    admin.from("projects").select("id, title, client_name, status").eq("company_id", companyId)
      .in("status", ["won", "sent"]).order("updated_at", { ascending: false }).limit(300),
  ]);
  const migrated = !(conns.error && isMissingTable(conns.error));
  return NextResponse.json({
    migrated,
    keyConfigured: !!keyFromEnv(),
    canManage: me.canManage,
    providers: providerDefs(),
    connections: migrated ? (conns.data || []) : [],
    stations: migrated ? (stations.data || []) : [],
    projects: projects.data || [],
  });
}

export async function POST(req) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Each attempt is a login against a manufacturer's server; don't let this
  // route be used to test logins against one. Per IP too: demo workspaces are
  // one click away, so a per-company limit alone is easy to sidestep.
  if (await isRateLimited(`inv-connect:${me.companyId}`, 10, 3600_000)
    || await isRateLimited(`inv-connect-ip:${clientIp(req)}`, 20, 3600_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const result = await connectAccount(me.admin, {
    companyId: me.companyId, userId: me.user.id, provider: String(body?.provider || ""),
    label: body?.label, rawCreds: body?.credentials || {}, key: keyFromEnv(),
  });
  if (result.error) {
    const status = result.error === "portal" ? 422 : result.error === "not_migrated" || result.error === "no_secret_key" ? 503 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
