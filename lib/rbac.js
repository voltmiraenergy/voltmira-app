// lib/rbac.js — one definition of what a job title (profiles.title, see
// add-profile-title.sql) actually restricts, so the answer never drifts
// between the projects list, the editor's save action, and the Team page.
//
// Two SEPARATE dimensions, never conflated:
//   role  ('owner'|'member')            — billing/admin superuser vs. everyone else
//   title ('sales'|'engineer'|'manager'|'') — job function, cosmetic until this file
//
// An owner is always fully privileged regardless of title — they're the
// account holder, not a job function. A member with NO title set (title==='',
// the column's own default, and the state of every teammate invited before
// this feature existed) is treated as FULLY PRIVILEGED too: title is opt-in
// classification, not a lockdown that silently applies to people nobody ever
// actually assigned a role. Only an EXPLICIT title restricts anything.
//
// Company-wide kill switch: every check here also takes `rbacEnabled`
// (companies.rbac_enabled, see add-rbac.sql, default false) and returns the
// fully-privileged answer when it's off. Real enforcement must not silently
// change what an existing team can already do the moment this code ships —
// same reasoning as nudge_enabled/crm_webhook_enabled shipping opt-in.

/** True if this profile may see/edit every project in the company, not just their own. */
export function canViewAllProjects(profile, rbacEnabled) {
  if (!rbacEnabled) return true;
  if (!profile) return true;
  if (profile.role === "owner") return true;
  if (!profile.title) return true;
  return profile.title !== "sales";
}

/** True if this profile may change a project's BOM/inverter/technical config. */
export function canEditTechnical(profile, rbacEnabled) {
  if (!rbacEnabled) return true;
  if (!profile) return true;
  if (profile.role === "owner") return true;
  if (!profile.title) return true;
  return profile.title !== "sales";
}

/** True if this profile may see OTHER teammates' pipeline/performance numbers. */
export function canViewTeamPerformance(profile, rbacEnabled) {
  if (!rbacEnabled) return true;
  if (!profile) return true;
  if (profile.role === "owner") return true;
  if (!profile.title) return true;
  return profile.title === "manager";
}
