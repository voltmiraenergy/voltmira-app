// app/api/forgot-password/route.js — send a branded, VoltMira-Support password
// reset email ourselves (Resend) instead of Supabase's bare default template.
//
// POST { email, token? }
//   • token is a Cloudflare Turnstile token from the login widget.
//   • A logged-in user resetting their OWN address (from /profile) skips the
//     captcha; everyone else must pass Turnstile when TURNSTILE_SECRET_KEY is set.
//   • The reply is ALWAYS { ok: true } — a different answer for unknown emails
//     would let anyone probe which addresses have accounts.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { sendEmail, resetPasswordEmail, supportFrom, emailConfigured } from "../../../lib/email.js";

const siteUrl = () => process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com";

/** Verify a Turnstile token. Returns true when the secret isn't configured
 *  (local/dev) so the flow still works before Turnstile is wired up. */
async function turnstileOk(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET;
  if (!secret) return true;          // not configured — don't block
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const j = await res.json().catch(() => ({}));
    return !!j.success;
  } catch { return false; }
}

export async function POST(req) {
  let b; try { b = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: true });

  // A signed-in user resetting their own address (from /profile) is trusted and
  // skips the captcha; a logged-out request from /login must pass Turnstile.
  let selfService = false;
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (user?.email && user.email.toLowerCase() === email) selfService = true;
  } catch { /* no session — treat as anonymous */ }

  if (!selfService && !(await turnstileOk(b.token))) {
    return NextResponse.json({ ok: true });   // same reply, no probing
  }

  const admin = supabaseAdmin();
  const redirectTo = `${siteUrl()}/reset-password`;
  try {
    // generateLink mints the recovery link WITHOUT sending Supabase's own email
    // (and errors for an address with no account — we swallow that silently).
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery", email, options: { redirectTo },
    });
    if (!error && data?.properties?.action_link && emailConfigured()) {
      // Localise to the person's workspace language when we can find it.
      let lang = "en";
      try {
        const uid = data.user?.id;
        if (uid) {
          const { data: prof } = await admin.from("profiles")
            .select("company_id").eq("id", uid).maybeSingle();
          if (prof?.company_id) {
            const { data: co } = await admin.from("companies")
              .select("lang").eq("id", prof.company_id).maybeSingle();
            if (co?.lang) lang = co.lang;
          }
        }
      } catch { /* language is a nicety — default to English */ }

      await sendEmail({
        to: email,
        from: supportFrom(),
        ...resetPasswordEmail({ resetLink: data.properties.action_link, lang }),
      });
    }
  } catch { /* never reveal anything about the address */ }

  return NextResponse.json({ ok: true });
}
