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
import { moneyFormatter } from "./money.js";

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

/** The four languages a workspace can use; anything else reads English. */
const LANGS = ["en", "ro", "ru", "uk"];
const langOf = (lang) => (LANGS.includes(lang) ? lang : "en");
const LOCALE = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
/** "6.0 kW" / "6,0 kW" / "6,0 кВт", in the reader's own format. */
const kwText = (kw, L) => {
  const n = Number(kw);
  if (!(n > 0)) return "";
  return `${n.toLocaleString(LOCALE[L], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${L === "ru" || L === "uk" ? "кВт" : "kW"}`;
};

/** The proposal itself, sent by the installer to their client, with the PDF
 *  attached, in the workspace's language and the formal voice a client is
 *  addressed in. Deliberately plain and short: the client's decision material
 *  is the attachment and the live link, not this covering note. The live link
 *  is listed FIRST because it is the tracked, interactive one; the PDF is the
 *  copy they forward to a spouse or a bank. */
export function proposalEmail({ clientName, companyName, liveUrl, kw, note, lang }) {
  const L = langOf(lang);
  const sys = kwText(kw, L);
  const coName = companyName || "VoltMira";
  const S = {
    en: {
      subject: sys ? `Your ${sys} solar proposal from ${coName}` : `Your solar proposal from ${coName}`,
      h1: sys ? `Your ${sys} solar proposal` : "Your solar proposal",
      hi: (w) => (w ? `Hello ${w},` : "Hello,"),
      body: "The full proposal is attached as a PDF. You can also open the live version, where you can change the assumptions yourself and watch the payback update.",
      cta: "Open the live proposal",
      ask: "Questions about any number in it? Just reply to this email.",
      sent: "Sent by",
    },
    ro: {
      subject: sys ? `Oferta dumneavoastră solară de ${sys} de la ${coName}` : `Oferta dumneavoastră solară de la ${coName}`,
      h1: sys ? `Oferta dumneavoastră solară de ${sys}` : "Oferta dumneavoastră solară",
      hi: (w) => (w ? `Bună ziua, ${w},` : "Bună ziua,"),
      body: "Oferta completă este atașată în format PDF. Puteți deschide și versiunea online, unde puteți modifica ipotezele și vedea cum se actualizează perioada de recuperare.",
      cta: "Deschideți oferta online",
      ask: "Aveți întrebări despre vreo cifră? Răspundeți direct la acest email.",
      sent: "Trimis de",
    },
    ru: {
      subject: sys ? `Ваше предложение по солнечной станции ${sys} от ${coName}` : `Ваше предложение по солнечной станции от ${coName}`,
      h1: sys ? `Ваше предложение по солнечной станции ${sys}` : "Ваше предложение по солнечной станции",
      hi: (w) => (w ? `Здравствуйте, ${w}!` : "Здравствуйте!"),
      body: "Полное предложение приложено в формате PDF. Также можно открыть онлайн-версию: там вы можете сами изменить допущения и увидеть, как меняется окупаемость.",
      cta: "Открыть онлайн-предложение",
      ask: "Есть вопросы по цифрам? Просто ответьте на это письмо.",
      sent: "Отправлено:",
    },
    uk: {
      subject: sys ? `Ваша пропозиція сонячної станції ${sys} від ${coName}` : `Ваша пропозиція сонячної станції від ${coName}`,
      h1: sys ? `Ваша пропозиція сонячної станції ${sys}` : "Ваша пропозиція сонячної станції",
      hi: (w) => (w ? `Добрий день, ${w}!` : "Добрий день!"),
      body: "Повну пропозицію додано у форматі PDF. Також можна відкрити онлайн-версію: там ви можете самі змінити припущення й побачити, як змінюється окупність.",
      cta: "Відкрити онлайн-пропозицію",
      ask: "Маєте запитання щодо цифр? Просто дайте відповідь на цей лист.",
      sent: "Надіслано:",
    },
  }[L];
  const co = esc(companyName || "VoltMira");
  const extra = note
    ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${MUTED};white-space:pre-wrap;">${esc(note)}</p>`
    : "";
  const html = `<!DOCTYPE html><html lang="${L}"><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">${co}</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">${esc(S.h1)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED};">${S.hi(esc(clientName || "").trim())}</p>
    ${extra}
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${MUTED};">${S.body}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(liveUrl)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">${S.cta}</a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:12.5px;line-height:1.55;color:${MUTED};">${S.ask}</p>
  </td></tr>
  <tr><td style="padding:14px 4px 0;font-size:11.5px;color:${MUTED};">${S.sent} ${co}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: S.subject, html };
}

/** The proforma invoice, sent by the installer to their client, in the
 *  workspace's language and the formal voice. Short by design: the attachment
 *  is the document, this is the covering note. When a deposit is requested the
 *  amount is NOT restated here: the invoice is the single source of truth for
 *  figures, and a number repeated in two places is a number that can disagree
 *  with itself. */
export function proformaEmail({ clientName, companyName, depositPct, note, lang }) {
  const L = langOf(lang);
  const coName = companyName || "VoltMira";
  const p = Number(depositPct) > 0 ? Number(depositPct) : 0;
  const S = {
    en: {
      subject: p ? `Proforma invoice (${p}% deposit) from ${coName}` : `Proforma invoice from ${coName}`,
      h1: "Proforma invoice",
      hi: (w) => (w ? `Hello ${w},` : "Hello,"),
      lead: p
        ? `Attached is the proforma invoice for your system, covering the ${p}% deposit needed before work starts. It shows the deposit due and the balance on completion.`
        : "Attached is the proforma invoice for your system.",
      bank: "Bank details are on the invoice. Please quote the invoice number as the payment reference. Any questions, just reply to this email.",
      sent: "Sent by",
    },
    ro: {
      subject: p ? `Factură proforma (avans ${p}%) de la ${coName}` : `Factură proforma de la ${coName}`,
      h1: "Factură proforma",
      hi: (w) => (w ? `Bună ziua, ${w},` : "Bună ziua,"),
      lead: p
        ? `Vă transmitem atașat factura proforma pentru sistemul dumneavoastră, pentru avansul de ${p}% necesar înainte de începerea lucrărilor. Pe ea găsiți avansul de plată și soldul de achitat la finalizare.`
        : "Vă transmitem atașat factura proforma pentru sistemul dumneavoastră.",
      bank: "Datele bancare sunt pe factură. Vă rugăm să indicați numărul facturii ca referință la plată. Pentru orice întrebare, răspundeți direct la acest email.",
      sent: "Trimis de",
    },
    ru: {
      subject: p ? `Счёт-проформа (аванс ${p}%) от ${coName}` : `Счёт-проформа от ${coName}`,
      h1: "Счёт-проформа",
      hi: (w) => (w ? `Здравствуйте, ${w}!` : "Здравствуйте!"),
      lead: p
        ? `Во вложении счёт-проформа на вашу систему: аванс ${p}%, необходимый до начала работ. В нём указаны сумма аванса и остаток к оплате по завершении.`
        : "Во вложении счёт-проформа на вашу систему.",
      bank: "Банковские реквизиты указаны в счёте. Пожалуйста, укажите номер счёта в назначении платежа. Если есть вопросы, просто ответьте на это письмо.",
      sent: "Отправлено:",
    },
    uk: {
      subject: p ? `Рахунок-проформа (аванс ${p}%) від ${coName}` : `Рахунок-проформа від ${coName}`,
      h1: "Рахунок-проформа",
      hi: (w) => (w ? `Добрий день, ${w}!` : "Добрий день!"),
      lead: p
        ? `У вкладенні рахунок-проформа на вашу систему: аванс ${p}%, потрібний до початку робіт. У ньому вказано суму авансу й залишок до сплати після завершення.`
        : "У вкладенні рахунок-проформа на вашу систему.",
      bank: "Банківські реквізити вказано в рахунку. Будь ласка, зазначте номер рахунку в призначенні платежу. Якщо маєте запитання, просто дайте відповідь на цей лист.",
      sent: "Надіслано:",
    },
  }[L];
  const co = esc(coName);
  const extra = note
    ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${MUTED};white-space:pre-wrap;">${esc(note)}</p>`
    : "";
  const html = `<!DOCTYPE html><html lang="${L}"><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">${co}</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">${S.h1}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED};">${S.hi(esc(clientName || "").trim())}</p>
    ${extra}
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${MUTED};">${esc(S.lead)}</p>
    <p style="margin:0;font-size:12.5px;line-height:1.55;color:${MUTED};">${S.bank}</p>
  </td></tr>
  <tr><td style="padding:14px 4px 0;font-size:11.5px;color:${MUTED};">${S.sent} ${co}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: S.subject, html };
}

/** Team invite: a link to join the inviter's workspace (set password), in the workspace's language (informal Romanian: it goes to a colleague). */
export function teamInviteEmail({ inviteLink, companyName, lang }) {
  const L = langOf(lang);
  const S = {
    en: { fallback: "a VoltMira workspace", subject: "You're invited to join {co}", h1: "You've been invited to join {co}", p: "Click below to set your password and join the workspace on VoltMira: honest solar quotes with tracked proposals.", cta: "Accept the invite", paste: "Or paste this link into your browser:" },
    ro: { fallback: "un spațiu de lucru VoltMira", subject: "Ești invitat să te alături {co}", h1: "Ești invitat să te alături {co}", p: "Apasă mai jos ca să-ți alegi parola și să intri în spațiul de lucru VoltMira: oferte solare oneste, cu propuneri urmărite.", cta: "Acceptă invitația", paste: "Sau lipește acest link în browser:" },
    ru: { fallback: "рабочее пространство VoltMira", subject: "Вас пригласили в {co}", h1: "Вас пригласили в {co}", p: "Нажмите ниже, чтобы задать пароль и войти в рабочее пространство VoltMira: честные солнечные расчёты с отслеживаемыми предложениями.", cta: "Принять приглашение", paste: "Или вставьте эту ссылку в браузер:" },
    uk: { fallback: "робочий простір VoltMira", subject: "Вас запрошено до {co}", h1: "Вас запрошено до {co}", p: "Натисніть нижче, щоб задати пароль і долучитися до робочого простору VoltMira: чесні сонячні розрахунки з відстежуваними пропозиціями.", cta: "Прийняти запрошення", paste: "Або вставте це посилання в браузер:" },
  }[L];
  const name = companyName || S.fallback;
  const co = `<span style="color:${GREEN};">${esc(name)}</span>`;
  const subject = S.subject.replace("{co}", companyName || "VoltMira");
  const html = `<!DOCTYPE html><html lang="${L}"><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">Volt</span><span style="font-size:19px;font-weight:bold;color:${GREEN};">Mira</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">${S.h1.replace("{co}", co)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:${MUTED};">${S.p}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(inviteLink)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">${S.cta}</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:12px;color:${MUTED};word-break:break-all;">${S.paste}<br><a href="${esc(inviteLink)}" style="color:${GREEN};">${esc(inviteLink)}</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

/** Password reset — sent to a person who asked for a new password, in their
 *  workspace language. Delivered by us via Resend (branded, "VoltMira Support"
 *  sender) rather than Supabase's bare default template. */
export function resetPasswordEmail({ resetLink, lang }) {
  const L = langOf(lang);
  const S = {
    en: {
      subject: "Reset your VoltMira password",
      h1: "Reset your password",
      lead: "We received a request to reset the password for your VoltMira account. Click below to choose a new one.",
      cta: "Reset password",
      paste: "Or paste this link into your browser:",
      ignore: "If you didn't request this, you can safely ignore this email. Your password stays the same.",
      expiry: "For your security, this link expires shortly and can be used once.",
    },
    ro: {
      subject: "Resetează-ți parola VoltMira",
      h1: "Resetează-ți parola",
      lead: "Am primit o cerere de resetare a parolei contului tău VoltMira. Apasă mai jos ca să alegi una nouă.",
      cta: "Resetează parola",
      paste: "Sau lipește acest link în browser:",
      ignore: "Dacă nu tu ai cerut asta, poți ignora acest email. Parola rămâne neschimbată.",
      expiry: "Pentru siguranța ta, linkul expiră în scurt timp și poate fi folosit o singură dată.",
    },
    ru: {
      subject: "Сброс пароля VoltMira",
      h1: "Сброс пароля",
      lead: "Мы получили запрос на сброс пароля вашей учётной записи VoltMira. Нажмите ниже, чтобы задать новый.",
      cta: "Сбросить пароль",
      paste: "Или вставьте эту ссылку в браузер:",
      ignore: "Если вы этого не запрашивали, просто проигнорируйте письмо. Пароль останется прежним.",
      expiry: "В целях безопасности ссылка скоро истекает и действует один раз.",
    },
    uk: {
      subject: "Скидання пароля VoltMira",
      h1: "Скидання пароля",
      lead: "Ми отримали запит на скидання пароля вашого облікового запису VoltMira. Натисніть нижче, щоб задати новий.",
      cta: "Скинути пароль",
      paste: "Або вставте це посилання в браузер:",
      ignore: "Якщо ви цього не запитували, просто проігноруйте лист. Пароль залишиться тим самим.",
      expiry: "З міркувань безпеки посилання незабаром перестане діяти і спрацьовує лише один раз.",
    },
  }[L];
  const html = `<!DOCTYPE html><html lang="${L}"><body style="margin:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 4px 14px;"><span style="font-size:19px;font-weight:bold;color:${INK};">Volt</span><span style="font-size:19px;font-weight:bold;color:${GREEN};">Mira</span></td></tr>
  <tr><td style="background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;">
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};">${S.h1}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${MUTED};">${S.lead}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(resetLink)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">${S.cta}</a>
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
  // The money the client was shown is in the OFFER's currency at the rate
  // frozen with the proposal (snapshot.offerCurrency, snapshot.engine.fx);
  // then/now.monthlySavings arrive in EUR. Without them this stays in euro.
  currency = "EUR", fx = null,
}) {
  const L = langOf(lang);
  const S = {
    en: {
      subjectPrefix: "Your solar proposal from",
      hi: "Hello",
      then: "When we sent it", now: "As of today",
      payback: "Payback", monthly: "Monthly savings",
      cta: "Open your proposal",
      sign: "Questions about any number? Just reply to this email.",
      yrs: "yrs",
    },
    // the client is addressed formally
    ro: {
      subjectPrefix: "Oferta dumneavoastră solară de la",
      hi: "Bună ziua",
      then: "La momentul trimiterii", now: "Astăzi",
      payback: "Recuperare", monthly: "Economii lunare",
      cta: "Deschideți oferta",
      sign: "Aveți întrebări despre vreo cifră? Răspundeți direct la acest email.",
      yrs: "ani",
    },
    ru: {
      subjectPrefix: "Ваше солнечное предложение от",
      hi: "Здравствуйте",
      then: "На момент отправки", now: "Сегодня",
      payback: "Окупаемость", monthly: "Ежемесячная экономия",
      cta: "Открыть предложение",
      sign: "Есть вопросы по цифрам? Просто ответьте на это письмо.",
      yrs: "г.",
    },
    uk: {
      subjectPrefix: "Ваша пропозиція сонячної станції від",
      hi: "Добрий день",
      then: "На момент надсилання", now: "Сьогодні",
      payback: "Окупність", monthly: "Щомісячна економія",
      cta: "Відкрити пропозицію",
      sign: "Маєте запитання щодо цифр? Просто дайте відповідь на цей лист.",
      yrs: "р.",
    },
  }[L];
  const co = esc(companyName || "your installer");
  const who = esc(clientName || "").trim();
  const hi = who ? `${S.hi}, ${who},` : `${S.hi},`;
  const subject = `${S.subjectPrefix} ${companyName || "VoltMira"}`;
  const yrs = (n) => (n == null ? "-" : `${Number(n).toLocaleString(LOCALE[L], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${S.yrs}`);
  const money = moneyFormatter({ currency, lang: L, fx });
  const mo = (n) => (n == null ? "-" : money(n));
  const statRow = (label, thenVal, nowVal) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};text-align:right;color:${MUTED};font-size:12.5px;">${thenVal}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};text-align:right;font-weight:700;color:${INK};font-size:13.5px;">${nowVal}</td>
    </tr>`;
  const toneHtml = toneLine
    ? `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:${INK};font-weight:600;">${esc(toneLine)}</p>`
    : "";
  const html = `<!DOCTYPE html><html lang="${L}"><body style="margin:0;background:${PAPER};">
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
      ${statRow(S.payback, yrs(then?.paybackYears), yrs(now?.paybackYears))}
      ${statRow(S.monthly, mo(then?.monthlySavings), mo(now?.monthlySavings))}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${GREEN};border-radius:10px;">
      <a href="${esc(liveUrl)}" style="display:inline-block;padding:13px 24px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">${S.cta}</a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:12.5px;line-height:1.55;color:${MUTED};">${S.sign}</p>
  </td></tr>
  <tr><td style="padding:14px 4px 0;font-size:11.5px;color:${MUTED};">${preparedBy?.name ? esc(preparedBy.name) + ", " : ""}${co}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

function fmtSeconds(total, L = "en") {
  const U = { en: ["s", "m"], ro: ["s", "min"], ru: ["с", "мин"], uk: ["с", "хв"] }[L] || ["s", "m"];
  const s = Math.max(0, parseInt(total, 10) || 0);
  if (s < 60) return `${s} ${U[0]}`;
  return `${Math.floor(s / 60)} ${U[1]} ${s % 60} ${U[0]}`;
}

/**
 * The retention email: "your client just opened the proposal", in the
 * workspace's language (informal Romanian: it goes to the installer).
 * Table-based HTML so it renders in Gmail/Outlook/mobile clients.
 */
export function proposalOpenedEmail({
  projectTitle, clientName, code, opens, seconds, appUrl, lang,
}) {
  const L = langOf(lang);
  const S = {
    en: {
      who: "Your client", sub1: '{client} just opened "{title}"', subN: '{client} opened "{title}" again ({n} opens)',
      k1: "Proposal opened", kN: "Opened again", h1: "{client} just opened {title}", hN: "{client} is looking at {title}",
      opens: "Total opens", time: "Total time viewing", code: "Proposal code",
      lead1: "They're reading it right now. The best moment to follow up is in the next hour, while the numbers are fresh.",
      leadN: "A repeat visit usually means they're comparing or deciding. A short call now tends to land well.",
      cta: "Open your activity feed", foot: "You get this because proposal-open alerts are on for your company. Turn them off any time in {settings}.", settings: "Settings",
    },
    ro: {
      who: "Clientul tău", sub1: '{client} tocmai a deschis „{title}”', subN: '{client} a deschis din nou „{title}” ({n} deschideri)',
      k1: "Ofertă deschisă", kN: "Deschisă din nou", h1: "{client} tocmai a deschis {title}", hN: "{client} se uită la {title}",
      opens: "Deschideri în total", time: "Timp total de vizualizare", code: "Codul ofertei",
      lead1: "O citește chiar acum. Cel mai bun moment pentru un apel este în următoarea oră, cât cifrele sunt proaspete.",
      leadN: "O revenire înseamnă de obicei că compară sau se hotărăște. Un apel scurt acum de obicei cade bine.",
      cta: "Deschide fluxul de activitate", foot: "Primești asta pentru că alertele de deschidere a ofertei sunt pornite pentru compania ta. Le oprești oricând din {settings}.", settings: "Setări",
    },
    ru: {
      who: "Ваш клиент", sub1: "{client} только что открыл «{title}»", subN: "{client} снова открыл «{title}» (открытий: {n})",
      k1: "Оферта открыта", kN: "Открыта снова", h1: "{client} только что открыл {title}", hN: "{client} смотрит {title}",
      opens: "Всего открытий", time: "Общее время просмотра", code: "Код оферты",
      lead1: "Клиент читает её прямо сейчас. Лучше всего позвонить в ближайший час, пока цифры свежи в памяти.",
      leadN: "Повторный визит обычно значит, что клиент сравнивает или принимает решение. Короткий звонок сейчас, как правило, уместен.",
      cta: "Открыть ленту активности", foot: "Вы получили это, потому что уведомления об открытии оферты включены для вашей компании. Отключить их можно в любой момент в разделе «{settings}».", settings: "Настройки",
    },
    uk: {
      who: "Ваш клієнт", sub1: "{client} щойно відкрив «{title}»", subN: "{client} знову відкрив «{title}» (відкриттів: {n})",
      k1: "Пропозицію відкрито", kN: "Відкрито знову", h1: "{client} щойно відкрив {title}", hN: "{client} переглядає {title}",
      opens: "Усього відкриттів", time: "Загальний час перегляду", code: "Код пропозиції",
      lead1: "Клієнт читає її просто зараз. Найкраще зателефонувати протягом найближчої години, поки цифри свіжі в пам'яті.",
      leadN: "Повторний візит зазвичай означає, що клієнт порівнює або вирішує. Короткий дзвінок зараз, як правило, доречний.",
      cta: "Відкрити стрічку активності", foot: "Ви отримали це, бо сповіщення про відкриття пропозиції увімкнено для вашої компанії. Вимкнути їх можна будь-коли в розділі «{settings}».", settings: "Налаштування",
    },
  }[L];
  const rawTitle = projectTitle || code;
  const rawClient = clientName || S.who;
  const title = esc(rawTitle);
  const client = esc(rawClient);
  const nOpens = Math.max(1, parseInt(opens, 10) || 1);
  const first = nOpens <= 1;
  const base = String(appUrl || "https://app.voltmira.com").replace(/\/+$/, "");
  const dash = `${base}/dashboard`;
  const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));

  const subject = fill(first ? S.sub1 : S.subN, { client: rawClient, title: rawTitle, n: nOpens });

  const statRow = (label, value) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${LINE};text-align:right;font-weight:600;color:${INK};font-size:13px;">${value}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="${L}"><body style="margin:0;padding:0;background:${PAPER};">
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
      ${first ? S.k1 : S.kN}</p>
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${INK};">
      ${fill(first ? S.h1 : S.hN, { client, title: `<span style="color:${GREEN};">${title}</span>` })}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
      ${statRow(S.opens, String(nOpens))}
      ${statRow(S.time, fmtSeconds(seconds, L))}
      ${statRow(S.code, esc(code))}
    </table>
    <p style="margin:0 0 18px;font-size:13.5px;line-height:1.55;color:${MUTED};">
      ${first ? S.lead1 : S.leadN}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${INK};border-radius:10px;">
      <a href="${dash}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none;">
        ${S.cta}</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 6px 0;font-size:11.5px;line-height:1.5;color:${MUTED};">
    ${fill(S.foot, { settings: `<a href="${base}/settings" style="color:${GREEN};">${S.settings}</a>` })}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, html };
}
