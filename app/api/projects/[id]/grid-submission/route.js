// app/api/projects/[id]/grid-submission/route.js — the quote's grid file sent
// to the operator, and its status after (docs/INTEGRATIONS.md). The
// installer's own Moldovan quote only.
// POST { action: "submit", operator, attached[], representative, note, docDates?, override?: { reason } }
//      { action: "client_lang", lang }   the language of the client's messages
//      { action: "status", submissionId, to, note, eventId }
//      { action: "resend", submissionId }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { billingGuard } from "../../../../../lib/invoiceServer.js";
import { OPERATORS } from "../../../../../lib/mdGrid.js";
import { gridApplicant, gridMissing } from "../../../../../lib/gridDetails.js";
import { productionPower } from "../../../../../lib/gridPower.js";
import { checkPackage, gridAdapterFor } from "../../../../../lib/gridSubmission.js";
import { submitGrid, updateGridStatus, resendGrid } from "../../../../../lib/gridFlow.js";
import { buildGridPackage, gridNotifier } from "../../../../../lib/gridServer.js";
import { sendEmail, emailConfigured } from "../../../../../lib/email.js";
import { isDemoEmail } from "../../../../../lib/demo.js";
import { mdDayKey } from "../../../../../lib/tz.js";
import { jobGate, gateStatus } from "../../../../../lib/jobFeeServer.js";
import { gridRulesFor } from "../../../../../lib/gridRulesStore.js";
import { canOverrideGrid } from "../../../../../lib/rbac.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_CODE = { demo_only: 403, override_not_allowed: 403, override_reason: 400, incomplete: 400, bad_transition: 409, already_submitted: 409, not_found: 404, needs_db: 503, needs_credit: 402, email_not_configured: 503, no_operator_email: 503 };

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

  // the language the client's messages go out in (null: the workspace's)
  if (body.action === "client_lang") {
    const l = ["en", "ro", "ru", "uk"].includes(body.lang) ? body.lang : null;
    const { error } = await db.from("projects").update({ client_lang: l }).eq("id", project.id).eq("company_id", co.id);
    if (error) return answer({ ok: false, error: /client_lang|column/i.test(error.message || "") ? "needs_db" : "save_failed" });
    return answer({ ok: true, lang: l });
  }

  if (body.action === "status") {
    const to = String(body.to || "");
    return answer(await updateGridStatus(db, {
      companyId: co.id, project, submissionId: String(body.submissionId || ""), to, note: body.note, source: "installer",
      // one tap is one change: the browser sends a key per click, a repeat is answered, not applied twice
      eventId: `installer-${String(body.eventId || "").slice(0, 80) || Date.now()}`, actor, today, io: notifier,
    }));
  }

  // sending the file is a won job's paperwork: it waits on the fee once the 14 days to pay are over
  // a demo workspace never sends a grid file to a real operator (lib/demoServer.js)
  if (body.action !== "client_lang" && body.action !== "status" && isDemoEmail(user.email)) return answer({ ok: false, error: "demo_only" });
  if (body.action === "resend" || body.action === "submit") {
    const gate = await jobGate(db, { project, co, user, produce: "grid_submit" });
    if (gate.locked) return NextResponse.json({ ok: false, error: gate.error, fee: gate.fee ? { status: gate.fee.status, amount_minor: gate.fee.amount_minor } : null }, { status: gateStatus(gate.error) });
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
  const applicant = gridApplicant(project.install_progress?.gridFile?.details, project);
  const missingDetails = gridMissing(applicant);
  // who applies decides the documents; the power is checked against what the operator's form allows
  const check = {
    kind: applicant.kind, installedKw: productionPower(project).kw,
    contractedKw: applicant.contractedKw, ceilingKw: Number(co.prosumer_limit_kw) > 0 ? Number(co.prosumer_limit_kw) : null,
  };

  // what this operator asks for today (lib/gridRules.js, /admin/grid), the issue dates of the documents that must be
  // recent, and an exception: only an owner or a manager may send a file that is not complete, with a reason
  const rules = await gridRulesFor(operator);
  const docDates = Object.fromEntries(Object.entries(body.docDates && typeof body.docDates === "object" ? body.docDates : {})
    .filter(([k, v]) => /^[a-z][a-z0-9_]{1,29}$/.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(String(v))).slice(0, 10));
  const override = body.override && typeof body.override === "object" ? { reason: String(body.override.reason || "").slice(0, 500) } : null;
  const { data: me } = await db.from("profiles").select("role, title").eq("id", user.id).maybeSingle();
  const pkgCheck = { ...check, rules, docDates, today };

  const adapter = gridAdapterFor(operator, { sendEmail, emailConfigured });
  const r = await submitGrid(db, {
    project, operator, ...check, rules, docDates, override, canOverride: canOverrideGrid(me), missingDetails, attached, representative, note: body.note, adapter, actor, today, io: notifier,
    buildPackage: (reference) => buildGridPackage({ project, co, operator, reference, checklist: checkPackage({ operator, ...pkgCheck, missingDetails, attached, representative }).checklist, note: body.note, replyTo: user.email }),
  });
  return answer(r);
}
