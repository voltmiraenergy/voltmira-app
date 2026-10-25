// app/api/service/[token]/route.js — a client reports a problem with their system from its link (app/s/[token]): a
// request in Service, up to 4 photos in the private bucket service-photos, the installer told by email and in
// Activity. Public, by the system's token; bot check (lib/turnstile.js) and rate limits by address and by system.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { turnstileOk } from "../../../../lib/turnstile.js";
import { createRequest } from "../../../../lib/serviceServer.js";
import { svt } from "../../../../lib/serviceText.js";
import { logActivity } from "../../../../lib/activity.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "../../../../lib/email.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 8 * 1024 * 1024;
const J = (b, status = 200) => NextResponse.json(b, { status });

export async function POST(req, ctx) {
  const { token } = await ctx.params;
  if (!TOKEN.test(String(token || ""))) return J({ error: "not_found" }, 404);
  const ip = clientIp(req);
  if (await isRateLimited(`svreq:${ip}`, 5, 3_600_000) || await isRateLimited(`svreq:t:${token}`, 6, 86_400_000)) return J({ error: "rate_limited" }, 429);
  let form;
  try { form = await req.formData(); } catch { return J({ error: "bad_request" }, 400); }
  if (!(await turnstileOk(String(form.get("captcha") || ""), { ip }))) return J({ error: "captcha" }, 400);
  const photos = form.getAll("photos").filter((x) => x && typeof x.arrayBuffer === "function");
  if (photos.length > 4 || photos.some((x) => !EXT[x.type] || x.size > MAX)) return J({ error: "photo" }, 400);

  const db = supabaseAdmin();
  const { data: project } = await db.from("projects").select("*").eq("service_token", token).maybeSingle();
  if (!project || project.status !== "won") return J({ error: "not_found" }, 404);
  const input = Object.fromEntries(["kind", "description", "contact_name", "contact_phone"].map((k) => [k, String(form.get(k) || "")]));

  const notifyOwner = async ({ request }) => {
    try {
      const [{ data: co }, { data: owner }] = await Promise.all([
        db.from("companies").select("lang").eq("id", project.company_id).maybeSingle(),
        db.from("profiles").select("email").eq("company_id", project.company_id).eq("role", "owner").limit(1).maybeSingle(),
      ]);
      if (!owner?.email || !emailConfigured()) return;
      const lang = co?.lang || "ro";
      const client = request.contact_name || project.client_name || project.title || "";
      const subject = svt("own_req_s", lang, { client, kind: svt("rk_" + request.kind, lang).toLowerCase() });
      const { html } = ownerAlertEmail({
        lang, kicker: svt("title", lang), heading: subject,
        rows: [[svt("r_system", lang), project.title || ""], [svt("r_phone", lang), request.contact_phone], [svt("r_desc", lang), request.description.slice(0, 300)]],
        lead: svt("own_req_p", lang), cta: { label: svt("r_open", lang), href: `/service?tab=requests&r=${request.id}` }, appUrl: process.env.NEXT_PUBLIC_APP_URL,
      });
      await sendEmail({ to: owner.email, subject, html });
    } catch (e) { console.error("[service] owner not told:", e?.message); }
  };

  const r = await createRequest(db, { project, input, source: "client", io: { logActivity, notifyOwner } });
  if (!r.ok) return J({ error: r.error, fields: r.fields }, r.error === "invalid" ? 400 : 500);
  // the photos: best effort, the request stands without them
  for (const [i, file] of photos.entries()) {
    const path = `${project.company_id}/${r.request.id}/${i + 1}.${EXT[file.type]}`;
    const up = await db.storage.from("service-photos").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (!up.error) await db.from("service_photos").insert({ request_id: r.request.id, company_id: project.company_id, path });
  }
  return J({ ok: true });
}
