// app/demo/route.js — starts a live demo of the REAL app.
//
// This used to serve app/_landing/demo.html, a standalone vanilla-JS replica of
// the dashboard. That replica had to be updated by hand for every feature and
// had fallen a long way behind (no Team page, no install checklist, no BOM, no
// follow-up strip). Now /demo provisions a real, disposable tenant and signs the
// visitor into it, so the demo IS the product — it can't drift.
//
// Three cases, in order:
//   already in a demo   -> reuse it (refreshing /demo must not spawn tenants)
//   signed in for real  -> interstitial; starting the demo would sign them out
//   signed out          -> seed a workspace and drop them on the dashboard
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createDemoWorkspace } from "../../lib/demoSeed.js";
import { isDemoEmail } from "../../lib/demo.js";
import { isRateLimited, clientIp } from "../../lib/ratelimit.js";

export const dynamic = "force-dynamic";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

const LANGS = new Set(["en", "ro", "ru"]);

function page(title, body, status = 200) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — VoltMira</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F5F0;color:#142A21;
       font:16px/1.6 Inter,system-ui,sans-serif;padding:24px}
  @media (prefers-color-scheme:dark){body{background:#0F1310;color:#EEF1EA}}
  .box{max-width:460px;text-align:center}
  h1{font-size:22px;margin:0 0 10px;letter-spacing:-.01em}
  p{margin:0 0 22px;opacity:.72}
  a{display:inline-block;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;margin:0 5px}
  .go{background:#1E6B4E;color:#fff}
  .alt{border:1px solid rgba(128,128,128,.35);color:inherit}
</style>
<div class="box">${body}</div>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req) {
  if (!URL_ || !ANON || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return page("Demo unavailable",
      `<h1>The demo isn't available right now</h1><p>Come back in a few minutes.</p><a class="alt" href="/">Back to the site</a>`, 503);
  }

  const url = new URL(req.url);
  const lang = LANGS.has(url.searchParams.get("lang")) ? url.searchParams.get("lang") : "ro";
  const dest = new URL("/dashboard", req.url);

  // ---- is someone already signed in here? ----------------------------
  // Read-only client: we only need getUser(), and we must NOT write auth
  // cookies until we've decided to actually start a demo.
  const probe = createServerClient(URL_, ANON, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await probe.auth.getUser();

  if (user) {
    // Already inside a demo tenant — reuse it. This is what stops a refresh (or
    // a second click on the demo link) from provisioning another workspace.
    if (isDemoEmail(user.email)) return NextResponse.redirect(dest);

    // A real account. Signing in as the demo owner would replace their session
    // and quietly log them out of their own workspace, so make it a choice.
    if (!url.searchParams.get("confirm")) {
      return page("Start the demo",
        `<h1>You're signed in to your own workspace</h1>
         <p>Starting the demo signs you out of it. You can sign back in straight after — or open the demo in a private window to keep both.</p>
         <a class="go" href="/demo?confirm=1&lang=${lang}">Start the demo anyway</a>
         <a class="alt" href="/dashboard">Back to my dashboard</a>`);
    }
  }

  // ---- provisioning is expensive: rate-limit it ----------------------
  // Creating a tenant means 4 auth users plus ~60 rows. Cheap enough for a real
  // visitor, worth capping against a crawler or someone hammering the link.
  if (await isRateLimited(`demo:${clientIp(req)}`, 6, 60 * 60 * 1000)) {
    return page("Demo limit reached",
      `<h1>Too many demo workspaces from here</h1><p>Try again in an hour, or get in touch and we'll walk you through it live.</p><a class="alt" href="/">Back to the site</a>`, 429);
  }

  let creds;
  try {
    creds = await createDemoWorkspace(lang);
  } catch (e) {
    console.error("[demo] seed failed:", e?.message || e);
    return page("Demo unavailable",
      `<h1>Couldn't start the demo</h1><p>Something went wrong setting up the sample workspace. Please try again.</p><a class="alt" href="/">Back to the site</a>`, 500);
  }

  // ---- sign the visitor in -------------------------------------------
  // Cookies are bound to the redirect response explicitly (the middleware
  // pattern) rather than via next/headers, so the Set-Cookie headers reliably
  // ride along with the 307 to /dashboard.
  const res = NextResponse.redirect(dest);
  const sb = createServerClient(URL_, ANON, {
    cookieOptions: { maxAge: AUTH_COOKIE_MAX_AGE },
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { error } = await sb.auth.signInWithPassword(creds);
  if (error) {
    console.error("[demo] sign-in failed:", error.message);
    return page("Demo unavailable",
      `<h1>Couldn't start the demo</h1><p>The workspace was created but sign-in failed. Please try again.</p><a class="alt" href="/">Back to the site</a>`, 500);
  }
  return res;
}
