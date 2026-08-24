// app/api/team/route.js — AUTHENTICATED team management (Team plan attribute).
// POST { email, name, title }  → add a teammate (owner only, seat-capped)
// POST { resend: <memberId> }  → re-send the join link to someone who hasn't signed in yet
// DELETE { id }                → remove a member's profile (owner only, not yourself)
//
// The caller is identified from their session cookie; the service role is used
// ONLY for the two operations RLS can't express: creating an auth user via
// invite email, and writing a profile row for a user who doesn't exist yet.
import { NextResponse } from "next/server";
import { seatCap } from "../../../lib/plans.js";
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

const siteUrl = () => process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com";

/**
 * Ask Supabase for a link that lands the person on /reset-password with a live
 * session, so they can pick a password and land in the workspace.
 *
 * `invite` ONLY works for an email with no auth account; `recovery`/`magiclink`
 * ONLY work for one that already exists. So we try them in order and the first
 * one that succeeds also tells us which case we're in — no user-table scan, and
 * no dead end for someone who already signed up on their own (or who was
 * removed from the team earlier and is being added back).
 */
async function joinLink(admin, email, kinds) {
  const redirectTo = `${siteUrl()}/reset-password`;
  let lastErr = null;
  for (const type of kinds) {
    const { data, error } = await admin.auth.admin.generateLink({ type, email, options: { redirectTo } });
    if (!error && data?.properties?.action_link && data?.user?.id)
      return { kind: type, user: data.user, link: data.properties.action_link };
    lastErr = error;
  }
  return { error: lastErr };
}

/** Deliver the link ourselves (Resend). Returns what actually happened. */
async function deliver(admin, companyId, email, inviteLink) {
  if (!emailConfigured()) return { emailed: false, emailError: "not_configured" };
  const { data: co } = await admin.from("companies").select("name").eq("id", companyId).single();
  const r = await sendEmail({ to: email, ...teamInviteEmail({ inviteLink, companyName: co?.name }) });
  return { emailed: !!r.sent, emailError: r.sent ? null : (r.error || "send_failed") };
}

export async function POST(req) {
  const me = await callerProfile();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (me.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const admin = supabaseAdmin();

  // ── Re-send: the person already holds a seat but never signed in ───────────
  if (b.resend) {
    const { data: target } = await admin.from("profiles")
      .select("id, email").eq("id", String(b.resend)).eq("company_id", me.company_id).maybeSingle();
    if (!target?.email) return NextResponse.json({ error: "bad_target" }, { status: 404 });
    // They exist in auth already, so recovery is the link that works.
    const got = await joinLink(admin, target.email, ["recovery", "magiclink", "invite"]);
    if (got.error || !got.link) return NextResponse.json({ error: "invite_failed" }, { status: 502 });
    const sent = await deliver(admin, me.company_id, target.email, got.link);
    return NextResponse.json({ ok: true, inviteLink: got.link, resent: true, ...sent });
  }

  // ── Add a teammate ────────────────────────────────────────────────────────
  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim().slice(0, 120);
  const allowedTitles = ["sales", "engineer", "manager"];
  const title = allowedTitles.includes(b.title) ? b.title : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "bad_email" }, { status: 400 });

  // Seats come from lib/plans.js. This used to read
  //   plan === "enterprise" ? Infinity : 5
  // which handed Pro the same five seats the Team tier is sold on, so the paid
  // differentiator never existed. seatCap() also grandfathers: it can never
  // return fewer seats than the workspace already has in use.
  const { data: myCo } = await admin.from("companies")
    .select("plan").eq("id", me.company_id).single();
  const { count } = await admin.from("profiles")
    .select("id", { count: "exact", head: true }).eq("company_id", me.company_id);
  const used = count || 0;
  if (used >= seatCap(myCo?.plan, used)) {
    return NextResponse.json({ error: "seats" }, { status: 409 });
  }

  // generateLink CREATES the user (if new) and returns the join URL WITHOUT
  // depending on Supabase's built-in SMTP (rate-limited and often undelivered).
  // We deliver it ourselves via Resend AND always return it, so the owner can
  // share it directly (WhatsApp/email) if mail is down.
  const got = await joinLink(admin, email, ["invite", "recovery", "magiclink"]);
  if (got.error || !got.link)
    return NextResponse.json({ error: "invite_failed" }, { status: 502 });

  // Which link type worked says NOTHING about whether this is a new person:
  // Supabase happily re-issues an `invite` for an account that exists but has
  // never signed in, so keying off that silently skipped the checks below.
  // The profile row is the real question — does this human already belong
  // somewhere? — and it answers correctly no matter how the link was minted.
  const { data: prof } = await admin.from("profiles")
    .select("id, company_id, role").eq("id", got.user.id).maybeSingle();
  const existing = !!prof;
  let moved = false;

  if (prof?.company_id === me.company_id)
    return NextResponse.json({ error: "already_member" }, { status: 409 });

  if (prof?.company_id) {
    // Anyone who ever signed up got their own workspace, so almost every real
    // teammate lands here — refusing outright left NO way to build a team.
    // profiles.company_id is single-valued, so joining yours means leaving
    // theirs. That's a real trade-off, so we hand the owner the facts and let
    // them confirm rather than deciding silently in either direction.
    if (b.confirm !== true) {
      const [{ data: oldCo }, { count: quotes }, { count: leads }, { count: mates }] = await Promise.all([
        admin.from("companies").select("name").eq("id", prof.company_id).maybeSingle(),
        admin.from("projects").select("id", { count: "exact", head: true }).eq("company_id", prof.company_id),
        admin.from("leads").select("id", { count: "exact", head: true }).eq("company_id", prof.company_id),
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", prof.company_id),
      ]);
      return NextResponse.json({
        error: "other_team",
        detail: {
          company: oldCo?.name || "", quotes: quotes || 0, leads: leads || 0,
          // If they're the last profile in it, that workspace ends up with
          // nobody who can open it — the owner must see this before saying yes.
          lastMember: (mates || 0) <= 1,
        },
      }, { status: 409 });
    }
    moved = true;   // owner confirmed with the numbers in front of them
  }

  // Pre-create their profile IN THIS COMPANY (upsert — the invited user may
  // already have a stray row), so on first login they join the inviter's
  // workspace instead of bootstrap_company() making them a new one.
  const { error: e2 } = await admin.from("profiles")
    .upsert({ id: got.user.id, company_id: me.company_id, role: "member", email, name }, { onConflict: "id" });
  if (e2) return NextResponse.json({ error: "profile_failed" }, { status: 502 });

  // Job title — separate write so a workspace without the profiles.title column
  // still invites fine (error swallowed).
  if (title) {
    const { error: e3 } = await admin.from("profiles").update({ title }).eq("id", got.user.id);
    if (e3) console.warn("team invite: title not stored (run add-profile-title.sql?):", e3.message);
  }

  // Best-effort delivery; never blocks the invite.
  const sent = await deliver(admin, me.company_id, email, got.link);
  return NextResponse.json({ ok: true, inviteLink: got.link, existing, moved, ...sent });
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
  // Adding them back later still works: the invite falls through to a recovery
  // link once Supabase reports the address as already registered.
  return NextResponse.json({ ok: true });
}
