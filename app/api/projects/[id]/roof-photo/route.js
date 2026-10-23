// app/api/projects/[id]/roof-photo/route.js — the installer's own photo of the
// client's roof (a drone shot, a photo from the yard), shown on the offer and
// its PDF in place of the satellite image (app/p/[code]). The browser has
// already shrunk it to a JPEG of at most 1,600 px (RoofPhoto.jsx). This route
// checks the quote is the caller's (row security on the session client), that
// the file really is a JPEG and not too big, then stores it in the
// public-media bucket with the service role, under roofs/<company>/: the
// bucket's own write rules only cover logos and avatars, and the offer it
// appears on is public anyway.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../../../lib/supabase.js";
import { currentCompany } from "../../../../../lib/session.js";
import { projectVisibility } from "../../../../../lib/projectAccess.js";
import { isRateLimited } from "../../../../../lib/ratelimit.js";

export const runtime = "nodejs";
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(req, props) {
  const { id } = await props.params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isRateLimited(`roofphoto:${user.id}`, 20, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const { data: p } = await sb.from("projects").select("id, company_id, owner_id").eq("id", id).maybeSingle();
  if (!p || !(await projectVisibility(user, await currentCompany()))(p)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let file;
  try { file = (await req.formData()).get("photo"); } catch { return NextResponse.json({ error: "bad_form" }, { status: 400 }); }
  if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "no_file" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) return NextResponse.json({ error: "too_big" }, { status: 413 });
  // a JPEG starts FF D8 FF, whatever the browser says the type is
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return NextResponse.json({ error: "not_jpeg" }, { status: 415 });

  const path = `roofs/${p.company_id}/${p.id}-${Date.now()}.jpg`;
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from("public-media").upload(path, bytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("[roof-photo] upload failed:", error.message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  const { data } = admin.storage.from("public-media").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
