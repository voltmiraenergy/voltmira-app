// app/api/home/review/route.js — the homeowner rates the installer, once the
// system is commissioned (docs/MARKETPLACE.md). POST { projectId, rating, body }
import { NextResponse } from "next/server";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { homeGuard } from "../../../../lib/homeGuard.js";
import { submitReview } from "../../../../lib/homeownerFlow.js";
import { logActivity } from "../../../../lib/activity.js";
import { escapeHtml } from "../../../../lib/safe.js";

export async function POST(req) {
  if (await isRateLimited(`home-review:${clientIp(req)}`, 10, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const g = await homeGuard(body.projectId);
  if (g instanceof Response) return g;
  const { user, db } = g;
  const r = await submitReview(db, {
    userId: user.id, projectId: g.project.id, rating: body.rating, body: body.body,
    io: { notify: ({ project, review }) => logActivity(db, { companyId: project.company_id, kind: "won", key: "act_review", params: { b: project.client_name || "", n: review.rating }, text: `<b>${escapeHtml(project.client_name || "")}</b> rated your work ${review.rating} of 5`, link: `/projects/${project.id}` }) },
  });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "rating" ? 400 : 409 });
}
