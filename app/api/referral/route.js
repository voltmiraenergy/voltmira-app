// app/api/referral/route.js — a friend asks for a call from a client's
// recommendation page (app/r/[code]): a hot lead for the installer, marked as
// recommended by that client, an Activity line, the CRM webhook, and an email
// to the owner (the call-request switch). Only for a signed offer; rate-limited
// by address; a filled hidden field (a robot) is answered "ok" and dropped.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";
import { logActivity } from "../../../lib/activity.js";
import { escapeHtml } from "../../../lib/safe.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "../../../lib/email.js";
import { sendCrmWebhook } from "../../../lib/crmWebhook.js";
import { nt } from "../../../lib/notifyText.js";
import { firstName } from "../../../lib/clientJourney.js";

export const runtime = "nodejs";

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function POST(req) {
  if (await isRateLimited(`ref:${clientIp(req)}`, 5, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const code = clip(body.code, 16);
  const name = clip(body.name, 120);
  const phone = clip(body.phone, 30).replace(/[^\d+()\s-]/g, "");
  const locality = clip(body.locality, 80);
  if (clip(body.hp, 200)) return NextResponse.json({ ok: true });
  if (!/^[a-z0-9]{6,16}$/i.test(code) || name.length < 2 || phone.replace(/\D/g, "").length < 6) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals").select("code, project_id, company_id, accepted_at").eq("code", code).maybeSingle();
  if (!prop || !prop.accepted_at) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [{ data: co }, { data: pj }] = await Promise.all([
    db.from("companies").select("*").eq("id", prop.company_id).maybeSingle(),
    db.from("projects").select("title, client_name").eq("id", prop.project_id).maybeSingle(),
  ]);
  const lang = co?.lang || "ro";
  const by = pj?.client_name || "";
  const note = [nt("ref_note", lang, { by, title: pj?.title || code }), locality ? `${nt("ref_where", lang)}: ${locality}` : ""].filter(Boolean).join(". ");

  // source "referral" once add-referral-leads.sql has run; before that, a manual
  // lead on the "referral" channel that says so in its note
  const lead = { company_id: prop.company_id, name, phone, note, hot: true, channel: "referral" };
  let { error } = await db.from("leads").insert({ ...lead, source: "referral" });
  if (error && /source|check constraint/i.test(error.message || "")) ({ error } = await db.from("leads").insert({ ...lead, source: "manual" }));
  if (error && /channel/i.test(error.message || "")) ({ error } = await db.from("leads").insert({ ...lead, channel: undefined, source: "manual" }));
  if (error) {
    console.error("[referral] lead not saved:", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  await logActivity(db, {
    companyId: prop.company_id, kind: "lead", key: "act_referral", params: { b: name, by: firstName(by) },
    text: `<b>${escapeHtml(name)}</b> asked for a call, recommended by <b>${escapeHtml(by)}</b>`, link: "/leads",
  });
  await sendCrmWebhook(prop.company_id, "lead.created", { name, phone, source: "referral", referred_by: by, locality });

  try {
    if (emailConfigured() && co && co.notify_calls !== false) {
      const { data: owner } = await db.from("profiles").select("email").eq("company_id", prop.company_id).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
      if (owner?.email) {
        const { html } = ownerAlertEmail({
          lang, kicker: nt("ref_kicker", lang), heading: nt("ref_heading", lang, { name, by: firstName(by) || by }),
          rows: [[nt("call_phone", lang), phone], ...(locality ? [[nt("ref_where", lang), locality]] : []), [nt("ref_by", lang), by]],
          lead: nt("ref_lead", lang), cta: { label: nt("ref_cta", lang), href: "/leads" }, foot: nt("foot", lang), appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        await sendEmail({ to: owner.email, subject: nt("ref_subject", lang, { name }), html });
      }
    }
  } catch (e) {
    console.error("[referral] email failed:", e?.message);
  }
  return NextResponse.json({ ok: true, company: co?.short_name || co?.name || "" });
}
