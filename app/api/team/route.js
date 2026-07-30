// app/api/team/route.js — AUTHENTICATED team management (Team plan attribute).
// POST { email }  → invite a teammate (owner only, max 5 seats)
// DELETE { id }   → remove a member's profile (owner only, not yourself)
//
// The caller is identified from their session cookie; the service role is used
// ONLY for the two operations RLS can't express: creating an auth user via
// invite email, and writing a profile row for a user who doesn't exist yet.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { sendEmail, teamInviteEmail, emailConfigured } from "../../../lib/email.js";

async function callerProfile() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  // Read the caller's own profile via the service role, scoped to their
  // verified auth id — the `profiles` RLS recurses, so a user-session read fails.
  const { data: profile } = await supabaseAdmin().from("profiles")
    .select("id, company_id, role").eq("id", user.id).maybeSingle();
  return profile;
}

export async function POST(req) {
  const me = await callerProfile();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (me.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim().slice(0, 120);
  const allowedTitles = ["sales", "engineer", "manager"];
  const title = allowedTitles.includes(b.title) ? b.title : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "bad_email" }, { status: 400 });

  const admin = supabaseAdmin();
  // Seat cap is plan-aware: Enterprise is unlimited (the tier's headline promise),
  // everyone else is 5. Read the plan from the caller's own company.
  const { data: myCo } = await admin.from("companies")
    .select("plan").eq("id", me.company_id).single();
  const seatCap = myCo?.plan === "enterprise" ? Infinity : 5;
  const { count } = await admin.from("profiles")
    .select("id", { count: "exact", head: true }).eq("company_id", me.company_id);
  if ((count || 0) >= seatCap) return NextResponse.json({ error: "seats" }, { status: 409 });

  // generateLink CREATES the user (if new) and returns the invite URL WITHOUT
  // depending on Supabase's built-in SMTP (which is rate-limited and often
  // undelivered). We deliver the link ourselves via Resend when configured, and
  // ALWAYS return it so the owner can share it directly (WhatsApp/email) — that's
  // the fix for invites that used to "look sent" but never arrive. The link lands
  // on /reset-password where the invitee sets a password.
  const site = process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com";
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: "invite", email, options: { redirectTo: `${site}/reset-password` },
  });
  if (error) {
    const exists = /already|registered|exists|been registered/i.test(error.message || "");
    return NextResponse.json({ error: exists ? "exists" : "invite_failed" }, { status: exists ? 409 : 502 });
  }
  const inviteLink = linkData?.properties?.action_link || null;
  const newUserId = linkData?.user?.id;
  if (!newUserId || !inviteLink) return NextResponse.json({ error: "invite_failed" }, { status: 502 });

  // Pre-create their profile IN THIS COMPANY (upsert — the invited user may
  // already have a stray row), so on first login they join the inviter's
  // workspace instead of bootstrap_company() making them a new one.
  const { error: e2 } = await admin.from("profiles")
    .upsert({ id: newUserId, company_id: me.company_id, role: "member", email, name }, { onConflict: "id" });
  if (e2) return NextResponse.json({ error: "profile_failed" }, { status: 502 });

  // Job title — separate write so a workspace without the profiles.title column
  // still invites fine (error swallowed).
  if (title) {
    const { error: e3 } = await admin.from("profiles").update({ title }).eq("id", newUserId);
    if (e3) console.warn("team invite: title not stored (run add-profile-title.sql?):", e3.message);
  }

  // Best-effort delivery via our own email provider; never blocks the invite.
  let emailed = false;
  if (emailConfigured()) {
    const { data: co } = await admin.from("companies").select("name").eq("id", me.company_id).single();
    const r = await sendEmail({ to: email, ...teamInviteEmail({ inviteLink, companyName: co?.name }) });
    emailed = !!r.sent;
  }

  return NextResponse.json({ ok: true, inviteLink, emailed });
}

export async function DELETE(req) {
  const me = await callerProfile();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (me.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const id = String(b.id || "");
  if (!id || id === me.id) return NextResponse.json({ error: "bad_target" }, { status: 400 });

  const admin = supabaseAdmin();
  // Scope the delete to the caller's own company — never trust the raw id.
  const { error } = await admin.from("profiles")
    .delete().eq("id", id).eq("company_id", me.company_id);
  if (error) return NextResponse.json({ error: "remove_failed" }, { status: 502 });
  // Their auth account survives; on next login bootstrap gives them a fresh
  // empty workspace of their own — removal only revokes access to THIS one.
  return NextResponse.json({ ok: true });
}
