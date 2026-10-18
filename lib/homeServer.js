// lib/homeServer.js — the server side of a homeowner's account
// (docs/MARKETPLACE.md): who is signed in, the io the account flow uses, and
// the sign-in email. Server only.
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { ht } from "./homeText.js";

/** The signed-in homeowner, or null (a visitor, or an installer). */
export async function currentHomeowner() {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  return user?.app_metadata?.role === "homeowner" ? user : null;
}

/** Where links point: the app's own address in production, else this request's. */
export const appBase = (req) => process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

export function homeIo() {
  return {
    auth: supabaseAdmin().auth.admin,
    sendEmail, emailConfigured,
    emailHtml: (lang, { co, url }) => {
      const { html } = ownerAlertEmail({
        lang, kicker: ht("he_kicker", lang), heading: ht("he_heading", lang),
        lead: ht("he_lead", lang, { co }), cta: { label: ht("he_cta", lang), href: url },
        foot: ht("he_foot", lang), appUrl: process.env.NEXT_PUBLIC_APP_URL,
      });
      return { subject: ht("he_subject", lang), html };
    },
  };
}
