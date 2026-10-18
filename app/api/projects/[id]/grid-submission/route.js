// app/api/projects/[id]/grid-submission/route.js — the quote's grid file sent
// to the operator, and its status after (docs/INTEGRATIONS.md). The
// installer's own Moldovan quote only.
// POST { action: "submit", operator, attached[], representative, note }
//      { action: "status", submissionId, to, note, eventId }
//      { action: "resend", submissionId }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { billingGuard } from "../../../../../lib/invoiceServer.js";
import { OPERATORS } from "../../../../../lib/mdGrid.js";
import { gridApplicant, gridMissing } from "../../../../../lib/gridDetails.js";
import { checkPackage, gridAdapterFor } from "../../../../../lib/gridSubmission.js";
import { submitGrid, updateGridStatus, resendGrid } from "../../../../../lib/gridFlow.js";
import { buildGridPackage, gridNotifier } from "../../../../../lib/gridServer.js";
import { sendEmail, emailConfigured } from "../../../../../lib/email.js";
import { mdDayKey } from "../../../../../lib/tz.js";
import { gridFileDecision, creditsPaywallOn } from "../../../../../lib/credits.js";
import { creditBalance, paidBefore, spendCredits } from "../../../../../lib/creditAccess.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_CODE = { incomplete: 400, bad_transition: 409, already_submitted: 409, not_found: 404, needs_db: 503, needs_credit: 402, email_not_configured: 503, no_operator_email: 503 };

export async function POST(req, props) {
  const { id } = await props.params;
  if (await isRateLimited(`grid-sub:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await billingGuard(id);
  if (g instanceof Response) return g;
  const { user, co, project } = g;
  if (project.market && project.market !== "MD") return NextResponse.json({ error: "md_only" }, { status: 400 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  const db = supabaseAdmin();
  const actor = { id: user.id, email: user.email };
  const today = mdDayKey(Date.now());
  const { data: owner } = await db.from("profiles").select("email").eq("company_id", co.id).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
  const notifier = gridNotifier({ db, co, ownerEmail: owner?.email || "", source: "installer" });
  const answer = (r) => NextResponse.json(r, { status: r.ok ? 200 : STATUS_CODE[r.error] || 502 });

  if (body.action === "status") {
    const to = String(body.to || "");
    return answer(await updateGridStatus(db, {
      companyId: co.id, project, submissionId: String(body.submissionId || ""), to, note: body.note, source: "installer",
      // one tap is one change: the browser sends a key per click, a repeat is answered, not applied twice
      eventId: `installer-${String(body.eventId || "").slice(0, 80) || Date.now()}`, actor, today, io: notifier,
    }));
  }

  const savedOp = project.install_progress?.gridFile?.operator;
  if (body.action === "resend") {
    const { data: sub } = await db.from("grid_submissions").select("operator, checklist").eq("id", String(body.submissionId || "")).eq("company_id", co.id).maybeSingle();
    if (!sub) return answer({ ok: false, error: "not_found" });
    const adapter = gridAdapterFor(sub.operator, { sendEmail, emailConfigured });
    return answer(await resendGrid(db, {
      companyId: co.id, project, submissionId: String(body.submissionId), adapter, actor, today, io: notifier,
      buildPackage: (reference) => buildGridPackage({ project, co, operator: sub.operator, reference, checklist: sub.checklist, replyTo: user.email }),
    }));
  }
  if (body.action !== "submit") return NextResponse.json({ error: "bad_action" }, { status: 400 });

  const operator = OPERATORS[body.operator] ? body.operator : savedOp;
  if (!OPERATORS[operator]) return NextResponse.json({ error: "bad_operator" }, { status: 400 });
  const attached = Array.isArray(body.attached) ? body.attached.map(String).slice(0, 20) : [];
  const representative = body.representative === true;
  const missingDetails = gridMissing(gridApplicant(project.install_progress?.gridFile?.details, project));

  // the filled application costs a credit on the free plan, as its download does
  let spend = 0;
  if (creditsPaywallOn()) {
    const d = gridFileDecision({ plan: co.plan || "free", balance: await creditBalance(co.id), paidBefore: await paidBefore(co.id, "grid_file", project.id) });
    if (!d.allowed) return answer({ ok: false, error: "needs_credit" });
    spend = d.spend;
  }
  const adapter = gridAdapterFor(operator, { sendEmail, emailConfigured });
  const r = await submitGrid(db, {
    project, operator, missingDetails, attached, representative, note: body.note, adapter, actor, today, io: notifier,
    buildPackage: (reference) => buildGridPackage({ project, co, operator, reference, checklist: checkPackage({ operator, missingDetails, attached, representative }).checklist, note: body.note, replyTo: user.email }),
  });
  if (r.ok && spend) await spendCredits(co.id, spend, "grid_file", project.id);
  return answer(r);
}
