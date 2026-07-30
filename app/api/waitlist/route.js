// app/api/waitlist/route.js — PUBLIC landing-page waitlist signup.
// POST { email, name?, lang?, source?, website? (honeypot) }
// Persists the signup in Supabase (waitlist table, service role) AND forwards
// it to Formspree for an instant email notification. Rate-limited + honeypot.
//
// Why route through here instead of POSTing to Formspree from the browser:
// the site CSP only allows connect-src to 'self' + Supabase, so a client-side
// fetch to formspree.io is blocked. Same-origin here is allowed, and the
// server-to-Formspree call isn't subject to CSP.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";

const FORMSPREE = process.env.WAITLIST_FORMSPREE_URL || "https://formspree.io/f/xykqqoyo";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANGS = ["en", "ro", "ru"];

export async function POST(req) {
  const ip = clientIp(req);
  if (await isRateLimited(`waitlist:${ip}`, 5, 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });

  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot: silently drop bots

  const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "bad_email" }, { status: 400 });
  const name = String(b.name || "").trim().slice(0, 120);
  const lang = LANGS.includes(b.lang) ? b.lang : "en";
  const source = String(b.source || "landing").trim().slice(0, 40);

  let stored = false, notified = false, storeErr = "";

  // 1) Persist to Supabase. Upsert on email so a repeat signup refreshes
  //    name/lang instead of failing on the unique key.
  try {
    const { error } = await supabaseAdmin()
      .from("waitlist")
      .upsert({ email, name, lang, source, ip }, { onConflict: "email" });
    if (error) { storeErr = error.message; console.error("waitlist supabase upsert:", error.message); }
    else stored = true;
  } catch (e) {
    storeErr = e?.message || String(e);
    console.error("waitlist supabase threw:", storeErr);
  }

  // 2) Forward to Formspree for the instant email ping.
  //    If the DB write failed, say so loudly IN THE SUBJECT LINE: the inbox is
  //    the only place the owner reliably looks, and a silent storage failure
  //    otherwise hides behind the visitor's green tick.
  try {
    const subject = stored
      ? `New VoltMira waitlist signup: ${email}`
      : `[NOT SAVED TO DB] VoltMira waitlist signup: ${email}`;
    const r = await fetch(FORMSPREE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email, name, lang, source, _subject: subject,
        saved_to_database: stored ? "yes" : `NO — ${storeErr || "unknown error"} (this signup exists ONLY in this email)`,
      }),
    });
    notified = r.ok;
    if (!r.ok) console.error("waitlist formspree status:", r.status);
  } catch (e) {
    console.error("waitlist formspree threw:", e?.message || e);
  }

  // Only claim success if the signup landed somewhere durable.
  if (!stored && !notified) return NextResponse.json({ error: "failed" }, { status: 502 });
  // `stored`/`notified` are returned so a failure is inspectable rather than
  // hidden behind ok:true. The visitor still sees success when either sink
  // caught them — they really are on the list, so don't make them re-submit.
  return NextResponse.json({ ok: true, stored, notified });
}
