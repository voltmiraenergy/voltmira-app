// lib/leadChannels.js — marketing-channel attribution for leads.
// Shared by the Leads page (server) and LeadCard (client), so keep this a plain
// module with no "use client"/server-only imports.
//
// `leads.source` is the TECHNICAL origin the app records automatically
// (widget = website form, proposal = client requested a quote, manual = typed in).
// `leads.channel` is the MARKETING channel the installer assigns so they can see
// which spend actually pays off. When channel is unset we derive a sensible
// default from the technical source, so old leads still show something useful.

export const CHANNEL_ORDER = [
  "website", "facebook", "instagram", "whatsapp", "google", "referral", "coldcall", "other",
];

// A single restrained dot colour per channel — the chip itself stays neutral so
// the Leads list reads calm, not like a bag of highlighters.
export const CHANNEL_DOT = {
  website:  "#3B82C4",
  facebook: "#2563EB",
  instagram:"#C13584",
  whatsapp: "#25A560",
  google:   "#E89B2D",
  referral: "#1E6B4E",
  coldcall: "#8B6FC9",
  other:    "#66756C",
};

export const CHANNEL_SET = new Set(CHANNEL_ORDER);

// Derive the channel to display for a lead: the installer-set channel wins,
// otherwise fall back to the auto-detected source.
const SOURCE_TO_CHANNEL = { widget: "website", proposal: "referral", manual: "other" };
export function leadChannel(lead) {
  if (lead && CHANNEL_SET.has(lead.channel)) return lead.channel;
  return SOURCE_TO_CHANNEL[lead?.source] || "other";
}
