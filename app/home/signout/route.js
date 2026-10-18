// app/home/signout/route.js — a homeowner signs out (POST from their page).
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase.js";

export async function POST(req) {
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/home/login", new URL(req.url).origin), 303);
}
