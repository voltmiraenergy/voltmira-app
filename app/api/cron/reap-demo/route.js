// app/api/cron/reap-demo/route.js — deletes aged-out demo tenants.
//
// /demo provisions a real company plus four auth users per visitor (see
// lib/demoSeed.js). Without a reaper those accumulate forever, so this runs on a
// Vercel cron (vercel.json) and removes every demo workspace older than
// TTL_HOURS.
//
// Demo accounts are identified by their email domain (lib/demo.js) rather than a
// flag column, so this needs no migration. That domain is only ever minted by
// the seeder, which makes the filter exact: a real installer's account can never
// match it. There is no code path here that widens the filter.
//
// Deleting the company cascades every public-schema row that belongs to it
// (projects -> proposals -> proposal_events, leads, products, activity,
// profiles). auth.users rows are outside that graph, so they're deleted
// explicitly afterwards.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDemoEmail } from "../../../../lib/demo.js";

export const dynamic = "force-dynamic";

const TTL_HOURS = 24;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. With no secret
  // configured, refuse outright rather than exposing an unauthenticated deleter.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url_ || !key) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const admin = createClient(url_, key, { auth: { persistSession: false } });
  const cutoff = Date.now() - TTL_HOURS * 3600_000;

  // Page through auth users and keep the demo ones that have aged out.
  const stale = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const users = data?.users || [];
    for (const u of users) {
      if (isDemoEmail(u.email) && new Date(u.created_at).getTime() < cutoff) stale.push(u);
    }
    if (users.length < 200) break;
  }

  // Group by company so each tenant is deleted once, not once per member.
  const companies = new Set();
  for (const u of stale) {
    const { data: prof } = await admin.from("profiles").select("company_id").eq("id", u.id).maybeSingle();
    if (prof?.company_id) companies.add(prof.company_id);
  }

  if (dry) {
    return NextResponse.json({
      dry: true, ttl_hours: TTL_HOURS,
      would_delete: { users: stale.length, companies: companies.size },
      emails: stale.map((u) => u.email),
    });
  }

  let deletedCompanies = 0, deletedUsers = 0;
  const failures = [];
  for (const id of companies) {
    const { error } = await admin.from("companies").delete().eq("id", id);
    if (error) failures.push({ company: id, error: error.message });
    else deletedCompanies++;
  }
  // Delete the auth users regardless of company outcome — an orphaned demo user
  // with no company would otherwise never be collected on a later run.
  for (const u of stale) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) failures.push({ user: u.email, error: error.message });
    else deletedUsers++;
  }

  return NextResponse.json({
    ok: true, ttl_hours: TTL_HOURS,
    companies: deletedCompanies, users: deletedUsers, failures,
  });
}
