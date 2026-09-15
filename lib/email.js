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

/** A "VoltMira Support" sender that reuses the verified address from RESEND_FROM,
 *  so account emails (like password resets) never show a personal name. */
export function supportFrom() {
  const raw = process.env.RESEND_FROM || "VoltMira <onboarding@resend.dev>";
  const m = raw.match(/<([^>]+)>/);
  const addr = m ? m[1].trim() : (raw.includes("@") ? raw.trim() : "onboarding@resend.dev");
  return `VoltMira Support <${addr}>`;
}

/** Low-level send. Returns { sent, skipped?, error? } and never throws.
 *  `attachments` is Resend's shape: [{ filename, content }] where content is a
 *  base64 string. Used to attach the generated proposal PDF. */
export async function sendEmail({ to, subject, html, attachments, replyTo, from }) {
  if (!emailConfigured()) return { sent: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from || process.env.RESEND_FROM || "VoltMira <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
        // Replies go to the installer, not to VoltMira's notify address — the
        // client is talking to their supplier, not to us.
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments?.length ? { attachments } : {}),
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

/** The proposal itself, sent by the installer to their client, with the PDF
 *  attached. Deliberately plain and short: the client's decision material is
 *  the attachment and the live link, not this covering note. The live link is
 *  listed FIRST because it is the tracked, interactive one — the PDF is the
 *  copy they forward to a spouse or a bank. */
export function proposalEmail({ clientName, companyName, liveUrl, kw, note }) {
  const co = esc(companyName || "Your installer");
  const who = esc(clientName || "").trim();
  const hi = who ? `Hello ${who},` : "Hello,";
  const sys = kw ? `${esc(kw)} kW` : "solar";
  const subject = `Your ${sys} solar proposal from ${companyName || "VoltMira"}`;
  const extra = note
    ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${MUTED};white-space:pre-wrap;">${esc(note)}</p>`
    : "";
  const html = `<!DOCTYPE html><html><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">${co}</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">Your ${sys} solar proposal</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED};">${hi}</p>
    ${extra}
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${MUTED};">The full proposal is attached as a PDF. You can also open the live version, where you can change the assumptions yourself and watch the payback update.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(liveUrl)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">Open the live proposal &rarr;</a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:12.5px;line-height:1.55;color:${MUTED};">Questions about any number in it? Just reply to this email.</p>
  </td></tr>
  <tr><td style="padding:14px 4px 0;font-size:11.5px;color:${MUTED};">Sent by ${co}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

/** The proforma invoice, sent by the installer to their client. Short by
 *  design: the attachment is the document, this is the covering note. When a
 *  deposit is requested the amount is NOT restated here — the invoice is the
 *  single source of truth for figures, and a number repeated in two places is a
 *  number that can disagree with itself. */
export function proformaEmail({ clientName, companyName, depositPct, note }) {
  const co = esc(companyName || "Your installer");
  const who = esc(clientName || "").trim();
  const hi = who ? `Hello ${who},` : "Hello,";
  const subject = depositPct > 0
    ? `Proforma invoice (${depositPct}% deposit) from ${companyName || "VoltMira"}`
    : `Proforma invoice from ${companyName || "VoltMira"}`;
  const lead = depositPct > 0
    ? `Attached is the proforma invoice for your system, covering the ${esc(depositPct)}% deposit needed before work starts. It shows the deposit due and the balance on completion.`
    : "Attached is the proforma invoice for your system.";
  const extra = note
    ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${MUTED};white-space:pre-wrap;">${esc(note)}</p>`
    : "";
  const html = `<!DOCTYPE html><html><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">${co}</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">Proforma invoice</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED};">${hi}</p>
    ${extra}
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${MUTED};">${lead}</p>
    <p style="margin:0;font-size:12.5px;line-height:1.55;color:${MUTED};">Bank details are on the invoice. Please quote the invoice number as the payment reference. Any questions, just reply to this email.</p>
  </td></tr>
  <tr><td style="padding:14px 4px 0;font-size:11.5px;color:${MUTED};">Sent by ${co}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

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

/** Password reset — sent to a person who asked for a new password, in their
 *  workspace language. Delivered by us via Resend (branded, "VoltMira Support"
 *  sender) rather than Supabase's bare default template. */
export function resetPasswordEmail({ resetLink, lang }) {
  const L = ["en", "ro", "ru"].includes(lang) ? lang : "en";
  const S = {
    en: {
      subject: "Reset your VoltMira password",
      h1: "Reset your password",
      lead: "We received a request to reset the password for your VoltMira account. Click below to choose a new one.",
      cta: "Reset password",
      paste: "Or paste this link into your browser:",
      ignore: "If you didn't request this, you can safely ignore this email — your password stays the same.",
      expiry: "For your security, this link expires shortly and can be used once.",
    },
    ro: {
      subject: "Resetează-ți parola VoltMira",
      h1: "Resetează-ți parola",
      lead: "Am primit o cerere de resetare a parolei contului tău VoltMira. Apasă mai jos ca să alegi una nouă.",
      cta: "Resetează parola",
      paste: "Sau lipește acest link în browser:",
      ignore: "Dacă nu tu ai cerut asta, poți ignora acest email — parola rămâne neschimbată.",
      expiry: "Pentru siguranța ta, linkul expiră în scurt timp și poate fi folosit o singură dată.",
    },
    ru: {
      subject: "Сброс пароля VoltMira",
      h1: "Сброс пароля",
      lead: "Мы получили запрос на сброс пароля вашей учётной записи VoltMira. Нажмите ниже, чтобы задать новый.",
      cta: "Сбросить пароль",
      paste: "Или вставьте эту ссылку в браузер:",
      ignore: "Если вы этого не запрашивали, просто проигнорируйте письмо — пароль останется прежним.",
      expiry: "В целях безопасности ссылка скоро истекает и действует один раз.",
    },
  }[L];
  const html = `<!DOCTYPE html><html><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">Volt</span><span style="font-size:19px;font-weight:bold;color:${GREEN};">Mira</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">${S.h1}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${MUTED};">${S.lead}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(resetLink)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">${S.cta} &rarr;</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:12px;color:${MUTED};word-break:break-all;">${S.paste}<br><a href="${esc(resetLink)}" style="color:${GREEN};">${esc(resetLink)}</a></p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.55;color:${MUTED};">${S.expiry}</p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.55;color:${MUTED};">${S.ignore}</p>
  </td></tr>
  <tr><td style="padding:14px 4px 0;font-size:11.5px;color:${MUTED};">VoltMira</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: S.subject, html };
}

/**
 * The follow-up nudge: sent to the CLIENT (not the installer) when their
 * proposal has sat unaccepted past a tier (see lib/nudgeTiers.js). Unlike
 * proposalOpenedEmail above (English-only, installer-facing), this needs the
 * resetPasswordEmail localization pattern — a real person in RO/MD is on the
 * other end of this one. `toneLine` is the ONLY freeform piece (a short
 * sentence a Make.com scenario phrases from the real numbers below) — it
 * must already be sanitized (length-capped, tag/URL-stripped) by the caller
 * before it reaches this function; `esc()` here is a second, defense-in-
 * depth pass, not the primary control.
 */
export function proposalNudgeEmail({
  clientName, companyName, liveUrl, lang, toneLine, then, now, preparedBy,
}) {
  const L = ["en", "ro", "ru"].includes(lang) ? lang : "en";
  const S = {
    en: {
      subjectPrefix: "Your solar proposal from",
      hi: "Hello",
      then: "When we sent it", now: "As of today",
      payback: "Payback", monthly: "Monthly savings",
      cta: "Open your proposal",
      sign: "Questions about any number? Just reply to this email.",
    },
    ro: {
      subjectPrefix: "Oferta ta solară de la",
      hi: "Salut",
      then: "La momentul trimiterii", now: "Astăzi",
      payback: "Amortizare", monthly: "Economii lunare",
      cta: "Deschide oferta",
      sign: "Întrebări despre vreo cifră? Răspunde direct la acest email.",
    },
    ru: {
      subjectPrefix: "Ваше солнечное предложение от",
      hi: "Здравствуйте",
      then: "На момент отправки", now: "Сегодня",
      payback: "Окупаемость", monthly: "Ежемесячная экономия",
      cta: "Открыть предложение",
      sign: "Есть вопросы по цифрам? Просто ответьте на это письмо.",
    },
  }[L];
  const co = esc(companyName || "your installer");
  const who = esc(clientName || "").trim();
  const hi = who ? `${S.hi} ${who},` : `${S.hi},`;
  const subject = `${S.subjectPrefix} ${companyName || "VoltMira"}`;
  const yrs = (n) => (n == null ? "—" : Number(n).toFixed(1));
  const mo = (n) => (n == null ? "—" : `€${Math.round(n)}`);
  const statRow = (label, thenVal, nowVal) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};text-align:right;color:${MUTED};font-size:12.5px;">${thenVal}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};text-align:right;font-weight:700;color:${INK};font-size:13.5px;">${nowVal}</td>
    </tr>`;
  const toneHtml = toneLine
    ? `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:${INK};font-weight:600;">${esc(toneLine)}</p>`
    : "";
  const html = `<!DOCTYPE html><html><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">${co}</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED};">${hi}</p>
    ${toneHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;">
      <tr><td></td>
        <td style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:${MUTED};padding-bottom:6px;">${S.then}</td>
        <td style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:${GREEN};padding-bottom:6px;">${S.now}</td></tr>
      ${statRow(S.payback, `${yrs(then?.paybackYears)}y`, `${yrs(now?.paybackYears)}y`)}
      ${statRow(S.monthly, mo(then?.monthlySavings), mo(now?.monthlySavings))}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(liveUrl)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">${S.cta} &rarr;</a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:12.5px;line-height:1.55;color:${MUTED};">${S.sign}</p>
  </td></tr>
  <tr><td style="padding:14px 4px 0;font-size:11.5px;color:${MUTED};">${preparedBy?.name ? esc(preparedBy.name) + " · " : ""}${co}</td></tr>
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
