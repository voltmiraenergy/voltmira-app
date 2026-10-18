// app/api/home/login/route.js — a homeowner asks for a sign-in link. The
// answer is the same whether or not the email has a system, so the form
// cannot be used to find out who is a client. Rate-limited by address and IP.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { loginLink, cleanEmail } from "../../../../lib/homeownerFlow.js";
import { homeIo, appBase } from "../../../../lib/homeServer.js";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const email = cleanEmail(body.email);
  if (await isRateLimited(`home-login:${clientIp(req)}`, 10, 60 * 60_000) || await isRateLimited(`home-login:${email}`, 4, 60 * 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });
  const r = await loginLink(supabaseAdmin(), { email, base: appBase(req), io: homeIo() });
  if (!r.ok && r.error === "email") return NextResponse.json(r, { status: 400 });
  if (!r.ok && r.error === "installer_account") return NextResponse.json(r, { status: 409 });
  return NextResponse.json({ ok: true });
}
