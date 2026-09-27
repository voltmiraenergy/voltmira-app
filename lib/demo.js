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

// Link previews, search crawlers and scripts. Every GET of /demo provisions a
// real tenant (four auth users and ~60 rows), so none of these may reach that
// path: app/demo/route.js answers them with a plain noindex page instead. This
// is what let /demo come out of robots.txt, where the Disallow showed up in
// Search Console as "Blocked by robots.txt".
//
// App names alone are not a signal: Viber, Telegram and WhatsApp open links in
// in-app browsers that send an ordinary "Mozilla/5.0 ..." agent, and those are
// real people. Their preview fetchers send "WhatsApp/2.x", "Viber/..." or
// "TelegramBot", which the not-Mozilla rule and /bot/ catch. (?<!cu) spares
// CUBOT phones, whose model name would otherwise read as a bot.
const NON_HUMAN_UA = /(?<!cu)bot|crawl|spider|slurp|facebookexternalhit|facebot|skypeuripreview|embedly|lighthouse|pagespeed|headlesschrome|python-requests|httpclient|go-http-client|node-fetch|axios|okhttp/i;

/** True when a request to /demo is not a person in a browser. */
export function isNonHumanAgent(ua) {
  return !ua || !/^Mozilla\//.test(ua) || NON_HUMAN_UA.test(ua);
}
