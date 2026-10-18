// app/api/admin/installers/route.js — the platform admin verifies installers
// (docs/MARKETPLACE.md). Platform admins only; anyone else gets a 404.
// POST { companyId, decision: "verified"|"rejected", note }
// GET  ?companyId=&kind=licence|insurance  -> a one-minute link to the document
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { decideVerification } from "../../../../lib/profileFlow.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "../../../../lib/email.js";
import { at } from "../../../../lib/adminText.js";

const nope = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function GET(req) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return nope();
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || "";
  const kind = url.searchParams.get("kind") === "insurance" ? "insurance_doc" : "licence_doc";
  const db = supabaseAdmin();
  const { data: p } = await db.from("installer_profiles").select(kind).eq("company_id", companyId).maybeSingle();
  if (!p?.[kind]) return nope();
  const { data, error } = await db.storage.from("verify-docs").createSignedUrl(p[kind], 60);
  if (error || !data?.signedUrl) return nope();
  return NextResponse.redirect(data.signedUrl);
}

export async function POST(req) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return nope();
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const db = supabaseAdmin();
  const companyId = String(b.companyId || "");
  const r = await decideVerification(db, {
    companyId, decision: b.decision, note: b.note, admin: { id: user.id, email: user.email },
    io: { notify: async ({ decision, note }) => {
      if (!emailConfigured()) return;
      const [{ data: co }, { data: owner }] = await Promise.all([
        db.from("companies").select("lang").eq("id", companyId).maybeSingle(),
        db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle(),
      ]);
      if (!owner?.email) return;
      const lang = co?.lang || "ro";
      const heading = at(decision === "verified" ? "ai_mail_verified" : "ai_mail_rejected", lang);
      const { html } = ownerAlertEmail({ lang, kicker: "VoltMira", heading, lead: decision === "verified" ? at("ai_mail_verified_l", lang) : note, cta: { label: at("ai_mail_cta", lang), href: "/marketplace" }, appUrl: process.env.NEXT_PUBLIC_APP_URL });
      await sendEmail({ to: owner.email, subject: heading, html });
    } },
  });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "needs_db" ? 503 : 400 });
}
