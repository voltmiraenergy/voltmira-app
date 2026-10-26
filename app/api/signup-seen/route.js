// app/api/signup-seen/route.js — the first time a signed-in person opens the app, their country and city (from the
// connection: Vercel's geo headers, never asked) and the device go onto their row in signup_log
// (supabase/add-signup-log.sql). Written once; before that file runs it does nothing.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const h = req.headers;
  const country = (h.get("x-vercel-ip-country") || "").toUpperCase().slice(0, 2);
  let city = h.get("x-vercel-ip-city") || "";
  try { city = decodeURIComponent(city); } catch { /* keep as sent */ }
  const patch = {
    first_seen_at: new Date().toISOString(),
    ...(/^[A-Z]{2}$/.test(country) ? { country } : {}),
    ...(city ? { city: city.slice(0, 80) } : {}),
    user_agent: String(h.get("user-agent") || "").slice(0, 240),
  };
  // only the first visit: the row that has not been seen yet
  const { error } = await supabaseAdmin().from("signup_log").update(patch).eq("user_id", user.id).is("first_seen_at", null);
  return NextResponse.json({ ok: !error });
}
