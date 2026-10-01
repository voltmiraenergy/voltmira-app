// lib/ics.js — a site visit as an .ics calendar file (RFC 5545), so the
// installer can put it in the phone's own calendar with one tap: iPhone,
// Android and Outlook all open it and offer "Add". Times go out in UTC, so the
// calendar shows them in whatever zone the phone is in.

const esc = (s) => String(s ?? "")
  .replace(/\\/g, "\\\\")
  .replace(/\r?\n/g, "\\n")
  .replace(/([,;])/g, "\\$1");

/** 2026-10-02T07:00:00.000Z -> 20261002T070000Z */
export const icsStamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Lines longer than 75 bytes continue on the next line after a space. */
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 74) { out.push(cur); cur = " "; bytes = 1; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

/**
 * @param {object} v
 * @param {string} v.uid          stable id, so re-adding the same visit updates it
 * @param {string|Date} v.start
 * @param {number} [v.minutes]    length, default 60
 * @param {string} v.title
 * @param {string} [v.location]
 * @param {string} [v.description]
 * @param {number} [v.now]        for DTSTAMP; tests pass a fixed value
 * @returns {string} the file's text
 */
export function visitIcs({ uid, start, minutes = 60, title, location = "", description = "", now = Date.now() }) {
  const end = new Date(new Date(start).getTime() + minutes * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VoltMira//Site visits//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(title)}`,
    location && `LOCATION:${esc(location)}`,
    description && `DESCRIPTION:${esc(description)}`,
    // a reminder an hour before, time to get on the road
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}
