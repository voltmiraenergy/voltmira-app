"use server";
// lib/feeActions.js — the installer's "client cancelled" on a signed job's
// fee card (components/fees/JobFeeCard.jsx): the job moves to lost, so its
// VoltMira fee goes (lib/successFees.js), with an Activity line and the CRM
// webhook a lost job sends anyway. RLS scopes the read and the write to the
// caller's company.
import { supabaseServer } from "./supabase.js";
import { currentActor } from "./session.js";
import { escapeHtml } from "./safe.js";
import { logActivity } from "./activity.js";
import { sendCrmWebhook } from "./crmWebhook.js";

export async function markJobCancelled(id) {
  const sb = await supabaseServer();
  const { data: p } = await sb.from("projects").select("status, title, company_id").eq("id", id).single();
  if (!p || p.status !== "won") return { ok: false, error: "not_signed" };
  const { error } = await sb.from("projects").update({ status: "lost" }).eq("id", id).eq("status", "won");
  if (error) return { ok: false, error: "failed" };
  await logActivity(sb, {
    companyId: p.company_id, kind: "sys", key: "act_client_cancelled",
    params: { b: p.title || "" },
    text: `<b>${escapeHtml(p.title || "")}</b>: the client cancelled`,
    actor: await currentActor(), link: `/projects/${id}`,
  });
  await sendCrmWebhook(p.company_id, "proposal.lost", { projectId: id, title: p.title || "" });
  return { ok: true };
}
