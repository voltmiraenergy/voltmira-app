// lib/tz.js — all user-facing dates/times render in the app's local timezone,
// NOT the server's. Server components run on Vercel (arn1 / UTC), so a bare
// toLocaleTimeString() showed the wrong wall-clock (Sweden/UTC) to Moldova and
// Romania users. Both markets sit in EET (UTC+2/+3, same DST rules), so a single
// fixed zone is correct for the whole user base.
export const APP_TZ = "Europe/Chisinau";

// Stable day identity ("YYYY-MM-DD") for a timestamp AS SEEN in APP_TZ — used to
// decide today/yesterday. en-CA gives ISO-ordered parts; the timeZone option is
// what actually shifts the date across the midnight boundary correctly (incl. DST).
export function mdDayKey(d) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

// Stable month identity ("YYYY-MM") in APP_TZ — used to bucket the dashboard's
// 6-month trend. Bucketing on raw server-local months put an event that happened
// just after midnight Chisinau (still the previous day in UTC) in the wrong month.
export function mdMonthKey(d) {
  return mdDayKey(d).slice(0, 7);
}

// "HH:MM" wall-clock in APP_TZ. hour12:false pins 24-hour (RO/MD convention) so
// no stray AM/PM can appear regardless of the runtime's default locale behaviour.
export function fmtTime(iso, locale) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: APP_TZ });
}

// Calendar date in APP_TZ; pass the same opts you'd give toLocaleDateString.
export function fmtDate(iso, locale, opts = {}) {
  return new Date(iso).toLocaleDateString(locale, { ...opts, timeZone: APP_TZ });
}

// Minutes APP_TZ is ahead of UTC at that instant (120 in winter, 180 in summer).
export function tzOffsetMin(d) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, timeZoneName: "shortOffset" })
    .formatToParts(new Date(d)).find((p) => p.type === "timeZoneName")?.value || "GMT+2";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 120;
}

// The instant that reads as dayKey ("YYYY-MM-DD") at hhmm ("HH:MM") on a
// Chișinău clock, e.g. a site visit "tomorrow at 10:00".
export function atLocal(dayKey, hhmm) {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - tzOffsetMin(guess) * 6e4;
  return new Date(guess - tzOffsetMin(first) * 6e4);
}
