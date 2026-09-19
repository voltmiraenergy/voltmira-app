// lib/crmWebhook.js — fires a real pipeline event (a new lead, a lead status
// change, a proposal sent/won) to the installer's OWN external CRM, if
// they've turned it on. Not a native Bitrix24/amoCRM API client: both those
// (and most others) accept a configured "incoming webhook" URL, so this
// posts one clean, documented JSON payload to whatever URL the installer
// pasted in Settings — that URL can point at a Bitrix24 incoming webhook, an
// amoCRM salesbot trigger, or a Zapier/Make/n8n catch-hook that fans out to
// anything. Never invented field-mapping for a specific CRM's own API shape,
// which this codebase has no way to verify without a live account to test
// against — same reasoning as reusing the generic Make.com webhook pattern
// (lib/automationAuth.js) instead of guessing at a vendor's exact schema.
//
// Fire-and-forget: this must NEVER fail or slow down the real action (saving
// a lead, marking a deal won) that triggered it. Every error is caught and
// logged, never thrown back to the caller.
//
// supabaseAdmin is imported dynamically below (not at module top level):
// lib/supabase.js pulls in next/headers, which only resolves inside a
// Next.js runtime — a static top-level import would break this file's own
// plain `node --test` unit tests (they always pass opts.admin, so the
// dynamic import is never reached).

const TIMEOUT_MS = 5000;

/**
 * @param {string} companyId
 * @param {string} event e.g. "lead.created", "lead.status_changed", "proposal.sent",
 *   "proposal.opened", "proposal.won", "proposal.lost", "invoice.created". The
 *   last one (app/(app)/projects/[id]/invoice/page.jsx) is also the honest
 *   answer to "1C integration": there is no live 1C instance anywhere in this
 *   codebase's history to build or test a direct API client against, so a
 *   real fiscal event fires here instead, for the installer's own
 *   Make/Zapier/n8n scenario to read and push into 1C (or any other
 *   accounting software) themselves.
 * @param {object} data event-specific payload (never includes cost/margin —
 *   see each call site for exactly what's sent)
 * @param {object} [opts] test seams: opts.admin (a pre-built client, skips
 *   the real supabaseAdmin() import) and opts.fetchImpl
 */
export async function sendCrmWebhook(companyId, event, data, opts = {}) {
  try {
    if (!companyId) return;
    const admin = opts.admin || (await import("./supabase.js")).supabaseAdmin();
    const fetchImpl = opts.fetchImpl || globalThis.fetch;
    const { data: co } = await admin.from("companies")
      .select("crm_webhook_url, crm_webhook_enabled").eq("id", companyId).maybeSingle();
    if (!co?.crm_webhook_enabled) return;
    const url = String(co.crm_webhook_url || "");
    if (!/^https:\/\//i.test(url)) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, companyId, at: new Date().toISOString(), data }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.warn(`[crmWebhook] ${event} failed:`, e?.message || e);
  }
}
