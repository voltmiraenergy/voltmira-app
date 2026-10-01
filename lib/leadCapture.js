// lib/leadCapture.js — save a homeowner who reached out, from any public
// channel: the website form (app/api/widget-lead) or the lead assistant's
// chats (lib/leadAgent.js on the website and Telegram). One path, so a lead
// looks the same in the installer's list however it arrived, and every one
// is logged and forwarded to their CRM.
import { escapeHtml } from "./safe.js";
import { logActivity } from "./activity.js";
import { sendCrmWebhook } from "./crmWebhook.js";

// Activity line per channel, translated on display (lib/i18n.js).
const ACTIVITY = {
  website: { key: "act_lead_widget", en: "the website widget" },
  website_chat: { key: "act_lead_webchat", en: "the website chat" },
  telegram: { key: "act_lead_telegram", en: "Telegram" },
};

/**
 * @param {object} db  service-role client
 * @param {object} l
 * @param {string} l.companyId
 * @param {string} l.name
 * @param {string} [l.phone] [l.email] [l.address] [l.message]
 * @param {string|number} [l.bill]  monthly bill, local currency
 * @param {{ kw?, costLocal?, paybackYears? }} [l.estimate]  what the homeowner was shown
 * @param {"website"|"website_chat"|"telegram"} [l.via]  where it came from, for the activity line
 * @param {string} [l.channel]  leads.channel (marketing attribution), e.g. "telegram"
 * @returns {Promise<{ ok: true, leadId: string|null } | { ok: false }>}
 */
export async function captureLead(db, l) {
  const companyId = String(l.companyId || "");
  const name = String(l.name || "").trim().slice(0, 120);
  const phone = String(l.phone || "").trim().slice(0, 40);
  const bill = String(l.bill ?? "").trim().slice(0, 20);
  const address = String(l.address || "").trim().slice(0, 200);
  // A structured number for "Generate a full offer" (createProjectFromLead) to
  // size a system from; `bill` stays the display string in `note`.
  const billNum = Number(bill);
  const monthlyBill = Number.isFinite(billNum) && billNum > 0 ? billNum : null;

  // What the calculator (or the assistant) showed this homeowner, so the
  // installer isn't guessing what was promised before they open the lead.
  const estKw = Number(l.estimate?.kw);
  const estCostLocal = Number(l.estimate?.costLocal);
  const estPaybackYears = Number(l.estimate?.paybackYears);
  const estimateLine = Number.isFinite(estKw) && estKw > 0
    ? `Estimate shown: ${estKw} kW` +
      (Number.isFinite(estCostLocal) && estCostLocal > 0 ? `, ${Math.round(estCostLocal).toLocaleString("en")}` : "") +
      (Number.isFinite(estPaybackYears) && estPaybackYears > 0 ? `, ~${estPaybackYears}y payback` : "")
    : null;

  const note = [
    phone && `Phone: ${phone}`,
    bill && `~${bill}/mo bill`,
    estimateLine,
    String(l.message || "").trim().slice(0, 500) || "Requested an estimate",
    address,
  ].filter(Boolean).join(", ");

  // A qualifying signal, not a constant: a phone number (reachable now) or a
  // stated bill (sized and motivated).
  const hot = !!(phone || bill);

  // CHECK THIS WRITE. A failed insert must never look like success: the
  // visitor would be thanked and the installer would never hear of them.
  const base = {
    company_id: companyId, name, note, hot, source: "widget",
    email: String(l.email || "").trim().slice(0, 120), phone,
  };
  const rich = { ...base, address: address || null, monthly_bill: monthlyBill, ...(l.channel ? { channel: l.channel } : {}) };
  // address/monthly_bill need add-lead-details.sql, channel add-leads-channel.sql;
  // degrade step by step to the base insert (note still carries them as text).
  let res = await db.from("leads").insert(rich).select("id").single();
  if (res.error && /channel/i.test(res.error.message || "")) {
    const { channel: _c, ...noChannel } = rich;
    res = await db.from("leads").insert(noChannel).select("id").single();
  }
  if (res.error && /address|monthly_bill/i.test(res.error.message || "")) {
    res = await db.from("leads").insert(base).select("id").single();
  }
  if (res.error) {
    console.error("[captureLead] insert failed:", res.error.message);
    return { ok: false };
  }

  const act = ACTIVITY[l.via] || ACTIVITY.website;
  await logActivity(db, {
    companyId, kind: "lead", key: act.key, params: { b: name },
    text: `New lead from ${act.en}: <b>${escapeHtml(name)}</b>`, link: "/leads",
  });
  // Awaited: a serverless function can be frozen the moment the handler
  // returns. sendCrmWebhook never throws and is capped at a 5s timeout.
  await sendCrmWebhook(companyId, "lead.created", { name, email: base.email, phone, address, monthlyBill, source: l.channel || "widget" });
  return { ok: true, leadId: res.data?.id || null };
}

/** Add a line to a lead's note (a survey request made later in the same chat). */
export async function appendLeadNote(db, { companyId, leadId, line, hot = true }) {
  const { data } = await db.from("leads").select("note").eq("id", leadId).eq("company_id", companyId).maybeSingle();
  if (!data) return false;
  const note = [data.note, String(line).slice(0, 400)].filter(Boolean).join(", ").slice(0, 2000);
  const { error } = await db.from("leads").update({ note, ...(hot ? { hot: true } : {}) }).eq("id", leadId).eq("company_id", companyId);
  return !error;
}
