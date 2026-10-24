// lib/leadToQuote.js — how long a lead waits for its offer: from the moment the lead arrived to the moment its
// quote's offer link was made (leads.created_at -> proposals.created_at, through leads.project_id). The dashboard
// shows the median over the last 90 days, the number the "quote in 10 minutes" work is measured by. Pure, no I/O.

const DAY = 86_400_000;

/**
 * @param {{created_at:string, project_id:string|null}[]} leads
 * @param {{project_id:string, created_at:string}[]} proposals
 * @param {{now?: number, days?: number}} [o]
 * @returns {{ medianHours: number|null, count: number }}
 */
export function leadToQuote(leads, proposals, { now = Date.now(), days = 90 } = {}) {
  const offerAt = new Map();
  for (const p of proposals || []) {
    const t = Date.parse(p?.created_at);
    if (!p?.project_id || !Number.isFinite(t)) continue;
    // a quote's first offer link is the one that counts
    if (!offerAt.has(p.project_id) || t < offerAt.get(p.project_id)) offerAt.set(p.project_id, t);
  }
  const hours = [];
  for (const l of leads || []) {
    const from = Date.parse(l?.created_at), to = offerAt.get(l?.project_id);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
    if (now - to > days * DAY) continue;
    hours.push((to - from) / 3_600_000);
  }
  if (!hours.length) return { medianHours: null, count: 0 };
  hours.sort((a, b) => a - b);
  const n = hours.length;
  const mid = n % 2 ? hours[(n - 1) / 2] : (hours[n / 2 - 1] + hours[n / 2]) / 2;
  return { medianHours: Math.round(mid * 10) / 10, count: n };
}
