// lib/marketServer.js — the marketplace's side effects (docs/MARKETPLACE.md):
// a request offered to an installer (an Activity line and an email to the
// owner, with the hours they have), accepted (a marketplace lead in their
// workspace), and what the homeowner hears (sent, accepted, nobody yet), with
// the link to follow it. Never breaks the flow. Server only.
import { logActivity } from "./activity.js";
import { captureLead } from "./leadCapture.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { raionName } from "./mdRaions.js";
import { ht } from "./homeText.js";
import { xt } from "./integrationText.js";

export function statusUrl(token) {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com").replace(/\/+$/, "");
  return `${base}/solar/status/${token}`;
}

export function marketIo(db) {
  const coCache = new Map();
  const company = async (id) => {
    if (!coCache.has(id)) {
      const { data } = await db.from("companies").select("id, name, short_name, lang").eq("id", id).maybeSingle();
      coCache.set(id, data || { id, name: "", lang: "ro" });
    }
    return coCache.get(id);
  };
  return {
    async createLead(companyId, r) {
      const res = await captureLead(db, {
        companyId, name: r.name, phone: r.phone, email: r.email, address: r.address, via: "marketplace", source: "marketplace",
        message: `${r.cons_kwh_year} kWh/an`, estimate: { kw: Number(r.kw), costLocal: r.estimate?.cost?.local, paybackYears: r.estimate?.payback?.expc },
      });
      return res.ok ? res.leadId : null;
    },
    async notifyInstaller({ companyId, offer, request }) {
      try {
        const co = await company(companyId);
        const lang = co.lang || "ro";
        const where = raionName(request.raion, lang) || request.raion || "";
        const hours = Math.max(1, Math.round((Date.parse(offer.respond_by) - Date.parse(offer.offered_at)) / 3600e3));
        await logActivity(db, { companyId, kind: "lead", key: "act_market_offer", params: { b: where, n: hours }, text: `New marketplace request in <b>${where}</b>`, link: "/marketplace" });
        if (!emailConfigured()) return;
        const { data: owner } = await db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
        if (!owner?.email) return;
        const { html } = ownerAlertEmail({
          lang, kicker: xt("mp_mail_kicker", lang), heading: xt("mp_mail_heading", lang, { where, kw: Number(request.kw) }),
          rows: [[xt("mp_kw", lang), `${Number(request.kw)} kW`], [xt("mp_cons", lang), `${request.cons_kwh_year} kWh`], [xt("mp_answer_by", lang), xt("mp_hours", lang, { n: hours })]],
          lead: xt("mp_mail_lead", lang), cta: { label: xt("mp_mail_cta", lang), href: "/marketplace" }, appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        await sendEmail({ to: owner.email, subject: xt("mp_mail_heading", lang, { where, kw: Number(request.kw) }), html });
      } catch (e) { console.error("[market] installer notify:", e?.message); }
    },
    async notifyHomeowner({ request, kind, companyIds = [], statusToken = null }) {
      try {
        if (!request.email || !emailConfigured()) return;
        const lang = request.lang || "ro";
        const names = [];
        for (const id of companyIds) { const c = await company(id); names.push(c.short_name || c.name); }
        const heading = kind === "accepted" ? ht("re_accepted", lang, { co: names.join(", ") }) : kind === "sent" ? ht("re_sent", lang, { n: companyIds.length }) : ht("re_unmatched", lang);
        const lead = ht(kind === "accepted" ? "re_accepted_l" : kind === "sent" ? "re_sent_l" : "re_unmatched_l", lang);
        // the status link is only known when the request is made (only its hash is
        // kept); an acceptance links to the installer's public profile instead
        let href = statusToken ? statusUrl(statusToken) : null;
        if (!href && kind === "accepted" && companyIds[0]) {
          const { data: prof } = await db.from("installer_profiles").select("slug").eq("company_id", companyIds[0]).maybeSingle();
          if (prof?.slug) href = `/i/${prof.slug}`;
        }
        const cta = href ? { label: ht(kind === "accepted" && !statusToken ? "rs_profile" : "re_cta", lang), href } : null;
        const { html } = ownerAlertEmail({ lang, kicker: ht("re_kicker", lang), heading, lead, cta, appUrl: process.env.NEXT_PUBLIC_APP_URL });
        await sendEmail({ to: request.email, subject: heading, html });
      } catch (e) { console.error("[market] homeowner notify:", e?.message); }
    },
  };
}
