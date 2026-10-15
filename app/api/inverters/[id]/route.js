// app/api/inverters/[id]/route.js — one inverter-portal account.
//   POST    { action: "sync" }  pull the latest monthly figures now
//   DELETE                      remove the account, its stored login and its
//                               station links (readings already stored stay)
import { NextResponse } from "next/server";
import { caller } from "../_caller.js";
import { keyFromEnv } from "../../../../lib/secretBox.js";
import { syncConnection } from "../../../../lib/inverterSync.js";
import { isRateLimited } from "../../../../lib/ratelimit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ownConnection(me, id) {
  const { data } = await me.admin.from("inverter_connections").select("id, company_id, provider")
    .eq("id", id).eq("company_id", me.companyId).maybeSingle();
  return data;
}

export async function POST(req, props) {
  const params = await props.params;
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const conn = await ownConnection(me, params.id);
  if (!conn) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Portals meter their own APIs tightly (FusionSolar allows a handful of
  // calls an hour); a stuck "Sync now" button mustn't burn the allowance.
  if (await isRateLimited(`inv-sync:${conn.id}`, 4, 3600_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const key = keyFromEnv();
  if (!key) return NextResponse.json({ error: "no_secret_key" }, { status: 503 });
  const result = await syncConnection(me.admin, conn, { key });
  return NextResponse.json(result);
}

export async function DELETE(_req, props) {
  const params = await props.params;
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const conn = await ownConnection(me, params.id);
  if (!conn) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Cascades to inverter_secrets and inverter_stations.
  const { error } = await me.admin.from("inverter_connections").delete().eq("id", conn.id);
  if (error) return NextResponse.json({ error: "db", message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
