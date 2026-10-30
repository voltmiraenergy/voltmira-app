// lib/contactLinks.js — one-tap links to reach a client or plan a visit: WhatsApp (wa.me needs the full
// international number) and a Google Calendar event. Used by the lead cards and the dashboard's to-do rows.
// Pure. The .ics file for the phone's own calendar is lib/ics.js.
import { icsStamp } from "./ics.js";

/**
 * The digits wa.me needs, or "" when the number is local ("069…"): a local number cannot become an
 * international one without guessing the country, so those get the call button only.
 */
export function waNumber(phone) {
  const p = String(phone || "").trim();
  const digits = p.replace(/\D/g, "");
  return (p.startsWith("+") || p.startsWith("00")) && digits.length >= 10 ? digits.replace(/^00/, "") : "";
}

/** A wa.me link to that number (with an optional message), or null without an international number. */
export function waLink(phone, text = "") {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
}

/** A Google Calendar "new event" link, prefilled; times in UTC so the calendar shows them in the phone's zone. */
export function googleCalUrl({ title, start, minutes = 60, location = "", details = "" }) {
  const t0 = new Date(start);
  if (!Number.isFinite(t0.getTime())) return null;
  const t1 = new Date(t0.getTime() + minutes * 60000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: title || "", dates: `${icsStamp(t0)}/${icsStamp(t1)}` });
  if (location) q.set("location", location);
  if (details) q.set("details", details);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
