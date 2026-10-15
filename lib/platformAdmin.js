// lib/platformAdmin.js — who may see numbers across every workspace (the
// traction page). Not a workspace role: an installer's owner is an admin of
// their own company only. The list lives in PLATFORM_ADMIN_EMAILS, comma
// separated; unset means nobody, so a fresh deployment exposes nothing.
// Compare against the address Supabase Auth verified, never one from a form.
export function platformAdmins(env = process.env) {
  return String(env.PLATFORM_ADMIN_EMAILS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isPlatformAdmin(email, env = process.env) {
  return typeof email === "string" && email.length > 0 && platformAdmins(env).includes(email.toLowerCase());
}
