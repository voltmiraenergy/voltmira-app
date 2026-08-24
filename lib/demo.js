// lib/demo.js — how we recognise an ephemeral demo tenant.
//
// Deliberately NOT a column on `companies`: that would need a migration run by
// hand in the SQL editor before /demo worked at all, and the app already has a
// perfectly precise marker. Every account created by lib/demoSeed.js gets an
// address at DEMO_DOMAIN, and nothing else ever does — real installers sign up
// with their own email. So the domain IS the flag, with zero schema coupling.
//
// Kept in its own tiny module so the layout and the reaper can import it
// without pulling in the seeder (and its service-role client) as well.
export const DEMO_DOMAIN = "demo.voltmira.com";

/** True for an address minted by createDemoWorkspace(). */
export function isDemoEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@" + DEMO_DOMAIN);
}
