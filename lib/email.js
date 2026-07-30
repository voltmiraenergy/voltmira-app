// lib/email.js — transactional email via Resend's REST API (no SDK needed).
//
// Setup (10 min, free tier = 100 emails/day, plenty for pilots):
//   1. Create an account at https://resend.com
//   2. Verify your sending domain (or use their onboarding domain to test)
//   3. Set env vars:
//        RESEND_API_KEY = re_...
//        RESEND_FROM    = "VoltMira <notify@voltmira.com>"   (must match a verified domain)
//
// Without RESEND_API_KEY every send is a silent no-op, so the app works
// before email is configured and in local dev.

const INK = "#142A21";
const PAPER = "#F6F5F0";
const GREEN = "#1E6B4E";
const AMBER = "#E89B2D";
const MUTED = "#66756C";
const LINE = "#E3E1D6";

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/** Low-level send. Returns { sent, skipped?, error? } and never throws. */
export async function sendEmail({ to, subject, html }) {
  if (!emailConfigured()) return { sent: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "VoltMira <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("resend error", res.status, body.slice(0, 300));
      return { sent: false, error: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("resend fetch failed", err?.message);
    return { sent: false, error: "network" };
  }
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Team invite: a link to join the inviter's workspace (set password). */
export function teamInviteEmail({ inviteLink, companyName }) {
  const co = esc(companyName || "a VoltMira workspace");
  const subject = `You're invited to join ${companyName || "VoltMira"}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">Volt</span><span style="font-size:19px;font-weight:bold;color:${GREEN};">Mira</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">You've been invited to join <span style="color:${GREEN};">${co}</span></h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:${MUTED};">Click below to set your password and join the workspace on VoltMira — honest solar quotes with tracked proposals.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(inviteLink)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">Accept the invite &rarr;</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:12px;color:${MUTED};word-break:break-all;">Or paste this link into your browser:<br><a href="${esc(inviteLink)}" style="color:${GREEN};">${esc(inviteLink)}</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

function fmtSeconds(total) {
  const s = Math.max(0, parseInt(total, 10) || 0);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * The retention email: "your client just opened the proposal".
 * Table-based HTML so it renders in Gmail/Outlook/mobile clients.
 */
export function proposalOpenedEmail({
  projectTitle, clientName, code, opens, seconds, appUrl,
}) {
  const title = esc(projectTitle || code);
  const client = esc(clientName || "Your client");
  const nOpens = Math.max(1, parseInt(opens, 10) || 1);
  const first = nOpens <= 1;
  const dash = `${appUrl || "https://app.voltmira.com"}/dashboard`;

  const subject = first
    ? `${client} just opened "${projectTitle || code}"`
    : `${client} opened "${projectTitle || code}" again (${nOpens} opens)`;

  const statRow = (label, value) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};text-align:right;font-weight:600;color:${INK};font-size:13px;">${value}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;">
    <span style="font-size:19px;font-weight:bold;color:${INK};">Volt</span><span style="font-size:19px;font-weight:bold;color:${GREEN};">Mira</span>
    <span style="display:inline-block;margin-left:8px;vertical-align:middle;">
      <span style="display:inline-block;width:4px;height:12px;background:#C4543B;border-radius:2px;transform:rotate(20deg);"></span>
      <span style="display:inline-block;width:4px;height:16px;background:${AMBER};border-radius:2px;transform:rotate(20deg);"></span>
      <span style="display:inline-block;width:4px;height:20px;background:#3FAE6A;border-radius:2px;transform:rotate(20deg);"></span>
    </span>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid ${LINE};border-radius:14px;padding:26px 26px 22px;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${GREEN};font-weight:bold;">
      ${first ? "Proposal opened" : "Opened again"}</p>
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${INK};">
      ${client} ${first ? "just opened" : "is looking at"} <span style="color:${GREEN};">${title}</span></h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
      ${statRow("Total opens", String(nOpens))}
      ${statRow("Total time viewing", fmtSeconds(seconds))}
      ${statRow("Proposal code", esc(code))}
    </table>
    <p style="margin:0 0 18px;font-size:13.5px;line-height:1.55;color:${MUTED};">
      ${first
        ? "They're reading it right now — the best moment to follow up is in the next hour, while the numbers are fresh."
        : "A repeat visit usually means they're comparing or deciding. A short call now tends to land well."}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${INK};border-radius:10px;">
      <a href="${dash}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none;">
        Open your activity feed &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 6px 0;font-size:11.5px;line-height:1.5;color:${MUTED};">
    You get this because proposal-open alerts are on for your company.
    Turn them off any time in <a href="${dash.replace(/\/dashboard$/, "/settings")}" style="color:${GREEN};">Settings</a>.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, html };
}
