// app/home/enter/route.js — where a homeowner's sign-in link lands
// (lib/homeownerFlow.js enterUrl): the one-time token becomes a session, and
// the homeowner goes to their page. A used or expired link goes to the
// sign-in page, which says so.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const th = url.searchParams.get("th") || "";
  const type = url.searchParams.get("t") === "email" ? "email" : "magiclink";
  if (!th || th.length > 200) return NextResponse.redirect(new URL("/home/login?e=link", url.origin));
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ token_hash: th, type });
  if (error || data?.user?.app_metadata?.role !== "homeowner") {
    if (!error) await sb.auth.signOut();
    return NextResponse.redirect(new URL("/home/login?e=link", url.origin));
  }
  return NextResponse.redirect(new URL("/home", url.origin));
}
