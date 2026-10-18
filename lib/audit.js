// lib/audit.js — the append-only audit log (supabase/add-tariffs-subsidies.sql):
// who changed what that matters (a tariff version, a programme, later a
// signature, a payment, a submission, a loan status), with the row before and
// after. Written with the service role; a database without the table yet only
// logs a warning, so a missing migration never blocks the change itself.

/**
 * @param {object} db  a service-role client (lib/supabase.js supabaseAdmin)
 * @param {object} a
 * @param {string|null} a.companyId  the workspace, or null for a platform action
 * @param {{id?:string,email?:string}|null} a.actor
 * @param {string} a.action          "tariff.publish", "subsidy.publish", ...
 * @param {string} a.entity          "tariff_rule", "subsidy_program", ...
 * @param {string} [a.entityId]
 * @param {object|null} [a.before]
 * @param {object|null} [a.after]
 * @returns {Promise<boolean>} written
 */
export async function writeAudit(db, { companyId = null, actor = null, action, entity, entityId = "", before = null, after = null }) {
  try {
    const { error } = await db.from("audit_log").insert({
      company_id: companyId, actor_id: actor?.id || null, actor_email: String(actor?.email || "").slice(0, 200),
      action: String(action).slice(0, 80), entity: String(entity).slice(0, 80), entity_id: String(entityId || "").slice(0, 120),
      before, after,
    });
    if (error) { console.warn("[audit] not written:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("[audit] not written:", e?.message);
    return false;
  }
}
