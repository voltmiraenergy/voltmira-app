// lib/dealNotify.js — tells the installer what a bank does on its deal room
// link: an activity row in the app, and an email (lib/dealEmail.js) to the
// person who opened the link, or the company owner. A question is sent at
// once. Visits and pack downloads share one alert window per link (6 hours):
// the request that claims the window sends one email listing everything the
// bank did since the previous alert. A link's own switch (deal_links.notify)
// turns the emails off. Never throws: a failed alert never blocks the bank.
// Server-only.
import { supabaseAdmin } from "./supabase.js";
import { sendEmail, emailConfigured } from "./email.js";
import { logActivity } from "./activity.js";
import { escapeHtml } from "./safe.js";
import { dealQuestionEmail, dealActivityEmail, plantUrl } from "./dealEmail.js";
import { findPlant } from "./bankPack.js";
import { normalizePlant } from "./plantFinance.js";
import { plt } from "./plantText.js";
import { normLang } from "./i18n.js";

export const ALERT_EVERY_MS = 6 * 60 * 60 * 1000;

/** The plant's name, the workspace's language and who receives the email. */
async function contextOf(db, link) {
  const [{ data: portfolio }, { data: co }] = await Promise.all([
    db.from("portfolios").select("id, assets").eq("id", link.portfolio_id).eq("company_id", link.company_id).maybeSingle(),
    db.from("companies").select("lang").eq("id", link.company_id).maybeSingle(),
  ]);
  const raw = portfolio ? findPlant(portfolio, link.plant_id) : null;
  const plant = raw ? normalizePlant(raw).name || "" : "";
  // the person who opened the link, while they are still in the company; else the owner
  let to = "";
  if (link.created_by) {
    const { data: me } = await db.from("profiles").select("email").eq("id", link.created_by).eq("company_id", link.company_id).maybeSingle();
    to = me?.email || "";
  }
  if (!to) {
    const { data: owner } = await db.from("profiles").select("email").eq("company_id", link.company_id).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
    to = owner?.email || "";
  }
  return { plant, lang: normLang(co?.lang), to, url: plantUrl(process.env.NEXT_PUBLIC_APP_URL, link.portfolio_id) };
}

const feedLink = (link) => `/portfolios/${link.portfolio_id}#plants`;
const wantsEmail = (link, c) => link.notify !== false && emailConfigured() && !!c.to;

/** A bank asked a question: an activity row and an email, at once. */
export async function notifyDealQuestion(link, question) {
  try {
    const db = supabaseAdmin();
    const c = await contextOf(db, link);
    const item = plt("pm_" + question.item_id, c.lang);
    await logActivity(db, {
      companyId: link.company_id, kind: "bank", key: "act_bank_question",
      params: { b: link.bank, title: c.plant, n: item },
      text: `<b>${escapeHtml(link.bank)}</b> asked about ${escapeHtml(plt("pm_" + question.item_id, "en"))} on "${escapeHtml(c.plant)}"`,
      link: feedLink(link),
    });
    if (!wantsEmail(link, c)) return;
    const { subject, html } = dealQuestionEmail({ lang: c.lang, bank: link.bank, plant: c.plant, item: question.item_id, askedBy: question.asked_by, body: question.body, url: c.url });
    await sendEmail({ to: c.to, subject, html });
  } catch (e) {
    console.error("[deal-notify] question alert failed:", e?.message || e);
  }
}

/**
 * A bank opened its link or downloaded the pack. One alert per link per
 * window: the request that claims it writes the activity row and sends one
 * email with what the bank did since the previous alert. A pack download is
 * always written to the activity feed.
 * @param {object} link  the deal_links row as read before this visit (its notified_at is the previous alert)
 * @param {"open"|"pack"} what
 */
export async function notifyDealActivity(link, what) {
  try {
    const db = supabaseAdmin();
    const now = new Date();
    const cutoff = new Date(now.getTime() - ALERT_EVERY_MS).toISOString();
    // claim the window in one update: only one request per link wins it
    const { data: claimed, error } = await db.from("deal_links").update({ notified_at: now.toISOString() })
      .eq("id", link.id).or(`notified_at.is.null,notified_at.lt.${cutoff}`).select("id").maybeSingle();
    const won = !error && !!claimed;
    if (!won && what !== "pack") return;
    const c = await contextOf(db, link);
    await logActivity(db, {
      companyId: link.company_id, kind: "bank", key: what === "pack" ? "act_bank_pack" : "act_bank_open",
      params: { b: link.bank, title: c.plant },
      text: what === "pack" ? `<b>${escapeHtml(link.bank)}</b> downloaded the bank pack of "${escapeHtml(c.plant)}"` : `<b>${escapeHtml(link.bank)}</b> opened the deal room of "${escapeHtml(c.plant)}"`,
      link: feedLink(link),
    });
    if (!won || !wantsEmail(link, c)) return;
    const since = link.notified_at || link.created_at;
    const { data: events } = await db.from("deal_views").select("at, what, detail").eq("link_id", link.id).gte("at", since).order("at", { ascending: true }).limit(50);
    const { subject, html } = dealActivityEmail({ lang: c.lang, bank: link.bank, plant: c.plant, events: events || [], url: c.url });
    await sendEmail({ to: c.to, subject, html });
  } catch (e) {
    console.error("[deal-notify] activity alert failed:", e?.message || e);
  }
}
