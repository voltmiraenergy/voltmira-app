// lib/phone.js — a client's phone as WhatsApp's wa.me wants it: country code
// and number, digits only ("069 123 456" in Moldova is "37369123456"). Numbers
// written the local way are read by the quote's market; anything that cannot
// be a phone gives "" so the caller falls back to "choose a contact".

const LOCAL = {
  MD: { cc: "373", len: 8 },   // 0 + 8 digits: 069 123 456
  RO: { cc: "40", len: 9 },    // 0 + 9 digits: 0721 234 567
  UA: { cc: "380", len: 9 },   // 0 + 9 digits: 050 123 4567
};

export function toIntlPhone(raw, market = "MD") {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let d = s.replace(/\D/g, "");
  if (s.startsWith("+")) return d.length >= 8 && d.length <= 15 ? d : "";
  if (d.startsWith("00")) { d = d.slice(2); return d.length >= 8 && d.length <= 15 ? d : ""; }
  for (const { cc, len } of Object.values(LOCAL)) {
    if (d.startsWith(cc) && d.length === cc.length + len) return d;
  }
  const loc = LOCAL[market] || LOCAL.MD;
  if (d.startsWith("0") && d.length === loc.len + 1) return loc.cc + d.slice(1);
  if (market === "MD" && d.length === loc.len) return loc.cc + d;
  return "";
}

/** A "Tel: ..." or "Phone ..." line in free-text notes, or "". */
export function phoneInText(text) {
  const m = String(text ?? "").match(/(?:tel(?:efon)?|phone|тел(?:ефон)?)\.?\s*:?\s*(\+?[\d][\d\s().-]{6,}\d)/i);
  return m ? m[1].trim() : "";
}
