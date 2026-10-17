// app/api/notify/reading-ok/route.js — "Checked, remind me in 30 days" from
// the reading alert (lib/readingAlerts.js), without signing in. GET shows a
// page with one button, because mail scanners open every link in an email;
// only the button's POST snoozes the alert for this quote (install_progress
// .readingSnoozeUntil). The link is signed (lib/notifySign.js), so it works
// for this quote only, and only from the email VoltMira sent.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { verifyAction } from "../../../../lib/notifySign.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { mdDayKey } from "../../../../lib/tz.js";
import { nt } from "../../../../lib/notifyText.js";
import { normLang } from "../../../../lib/i18n.js";

export const dynamic = "force-dynamic";
const SNOOZE_DAYS = 30;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function page(lang, title, body, status = 200) {
  return new NextResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#F4F2EA;color:#142A21;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{background:#fff;border:1px solid #E3E1D6;border-radius:14px;padding:26px;max-width:440px;width:100%}h1{font-size:20px;margin:0 0 10px}p{font-size:14px;line-height:1.5;color:#4A5A51}
button,a.b{display:inline-block;margin-top:8px;padding:12px 20px;border:0;border-radius:10px;background:#142A21;color:#fff;font:bold 14px Arial,sans-serif;text-decoration:none;cursor:pointer}a.l{color:#1E6B4E;font-size:13px}</style></head>
<body><main>${body}</main></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function load(req) {
  const u = new URL(req.url);
  const id = u.searchParams.get("p") || "", sig = u.searchParams.get("s") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyAction("reading-ok", id, sig)) return { bad: true };
  const db = supabaseAdmin();
  const { data: p } = await db.from("projects").select("id, title, company_id, install_progress").eq("id", id).maybeSingle();
  if (!p) return { bad: true };
  const { data: co } = await db.from("companies").select("lang").eq("id", p.company_id).maybeSingle();
  return { db, p, lang: normLang(co?.lang), id, sig };
}

export async function GET(req) {
  const r = await load(req);
  if (r.bad) return page("en", "Link not valid", "<h1>This link is not valid</h1><p>Open the quote in VoltMira instead.</p>", 404);
  const { p, lang, id, sig } = r;
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return page(lang, nt("rk_title", lang), `<h1>${esc(p.title || "")}</h1><p>${esc(nt("rk_ask", lang, { n: SNOOZE_DAYS }))}</p>
<form method="post" action="?p=${esc(id)}&amp;s=${esc(sig)}"><button type="submit">${esc(nt("rk_btn", lang))}</button></form>
<p><a class="l" href="${esc(base)}/projects/${esc(id)}?reading=1#workflow">${esc(nt("rd_enter", lang))}</a></p>`);
}

export async function POST(req) {
  if (await isRateLimited(`readok:${clientIp(req)}`, 30, 60_000)) return page("en", "Too many", "<h1>Too many requests</h1><p>Try again in a minute.</p>", 429);
  const r = await load(req);
  if (r.bad) return page("en", "Link not valid", "<h1>This link is not valid</h1>", 404);
  const { db, p, lang, id } = r;
  const until = mdDayKey(Date.now() + SNOOZE_DAYS * 864e5);
  const { error } = await db.from("projects").update({ install_progress: { ...(p.install_progress || {}), readingSnoozeUntil: until } }).eq("id", id);
  if (error) return page(lang, nt("rk_title", lang), `<h1>${esc(nt("rk_fail", lang))}</h1>`, 500);
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return page(lang, nt("rk_title", lang), `<h1>${esc(nt("rk_done", lang, { date: until }))}</h1><p><a class="b" href="${esc(base)}/projects/${esc(id)}">${esc(nt("acc_cta", lang))}</a></p>`);
}
