// lib/relTime.js — "2 hours ago" / "yesterday" / "3 days ago" in the reader's
// language, via Intl.RelativeTimeFormat, so every screen phrases elapsed time
// the same way instead of each one inventing its own "3d" / "acum 3z".

export const LOCALE = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export function relTime(iso, locale, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const s = (new Date(iso).getTime() - now) / 1000;
  const a = Math.abs(s);
  if (a < 60) return rtf.format(0, "second");
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 30 * 86400) return rtf.format(Math.round(s / 86400), "day");
  if (a < 365 * 86400) return rtf.format(Math.round(s / (30 * 86400)), "month");
  return rtf.format(Math.round(s / (365 * 86400)), "year");
}
