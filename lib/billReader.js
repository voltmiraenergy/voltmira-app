// lib/billReader.js — read a photo or PDF of an electricity bill with Claude.
//
// Shared by the installer's editor (app/api/extract-bill) and the lead
// assistant (a homeowner sends their bill on the website chat or Telegram).
// The model only transcribes what is printed; every number is checked here
// before anyone uses it, and nothing is ever filled in silently.
// Server-only.

export const BILL_MODEL = () => process.env.BILL_EXTRACT_MODEL || "claude-opus-5";
export const BILL_MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export const BILL_PROMPT = `You are reading a residential electricity bill from Romania or Moldova. The text may be in Romanian, Russian, Ukrainian or English.
Return ONLY a single minified JSON object (no prose, no code fences) with exactly these keys:
{"annualKwh": number|null, "monthlyKwh": number|null, "amountDue": number|null, "meterNumber": string|null, "supplier": string|null, "subsidy": string|null, "currency": string|null, "confidence": "high"|"medium"|"low", "notes": string}
Rules:
- annualKwh: total ANNUAL electricity consumption in kWh. Bills usually show a monthly consumption ("consum", "kWh consumat", "энергия", "потребление"). If only a monthly figure is shown, set monthlyKwh to that value and set annualKwh to monthlyKwh × 12. If an explicit 12-month / annual total is printed, use it for annualKwh and leave monthlyKwh null.
- amountDue: the total amount to pay for this bill's period ("total de plată", "suma spre plată", "к оплате"), as a plain number in the bill's currency. null if not clearly printed.
- meterNumber: the meter / POD identifier ("număr contor", "cod POD", "номер счётчика"). Do NOT guess: null if not clearly printed.
- supplier: the energy supplier's name.
- subsidy: any mention of an existing grant, subsidy, "Casa Verde", "prosumator"/"prosumer", or net-metering/net-billing status; else null.
- currency: RON, MDL or EUR if visible; else null.
- confidence: your confidence in annualKwh.
- notes: one short sentence on what you read or any caveat (e.g. "monthly 420 kWh × 12 estimated").
Use only numbers actually printed on the bill. Never invent values. If the image is not an electricity bill, return all nulls and say so in notes.`;

/** The image or PDF block for the Messages API, or null for a type we don't read. */
export function billMedia(bytes, mime) {
  const m = String(mime || "").toLowerCase();
  const b64 = Buffer.from(bytes).toString("base64");
  if (m === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(m)) return { type: "image", source: { type: "base64", media_type: m, data: b64 } };
  // Phones and Telegram sometimes label a JPEG loosely ("image/jpg", "image/*").
  if (m.startsWith("image/")) return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } };
  return null;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * The model's answer, checked: plausible household figures only, an annual
 * figure derived from a monthly one when only that was printed.
 * @returns {null | { annualKwh, monthlyKwh, amountDue, meterNumber, supplier, subsidy, currency, confidence, notes }}
 */
export function parseBill(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let d; try { d = JSON.parse(m[0]); } catch { return null; }
  let monthly = num(d.monthlyKwh);
  let annual = num(d.annualKwh);
  if (!annual && monthly) annual = Math.round(monthly * 12);
  if (!monthly && annual) monthly = Math.round(annual / 12);
  // A household uses tens to a few thousand kWh a month; anything outside is a misread.
  if (monthly && (monthly < 5 || monthly > 20000)) { monthly = null; annual = null; }
  const currency = ["RON", "MDL", "EUR"].includes(String(d.currency || "").toUpperCase()) ? String(d.currency).toUpperCase() : null;
  return {
    annualKwh: annual,
    monthlyKwh: monthly,
    amountDue: num(d.amountDue),
    meterNumber: d.meterNumber ? String(d.meterNumber).slice(0, 60) : null,
    supplier: d.supplier ? String(d.supplier).slice(0, 80) : null,
    subsidy: d.subsidy ? String(d.subsidy).slice(0, 120) : null,
    currency,
    confidence: ["high", "medium", "low"].includes(d.confidence) ? d.confidence : "low",
    notes: String(d.notes || "").slice(0, 240),
  };
}

/**
 * Read one bill.
 * @param {{ messages: { create: Function } }} client  an Anthropic client
 * @returns {Promise<{ ok: true, bill: object } | { ok: false, code: "type"|"too_large"|"declined"|"unreadable"|"auth"|"rate"|"failed" }>}
 */
export async function readBill(client, { bytes, mime, model = BILL_MODEL() }) {
  if (!bytes || bytes.length === 0) return { ok: false, code: "unreadable" };
  if (bytes.length > BILL_MAX_BYTES) return { ok: false, code: "too_large" };
  const media = billMedia(bytes, mime);
  if (!media) return { ok: false, code: "type" };
  try {
    const resp = await client.messages.create({
      model, max_tokens: 1024,
      messages: [{ role: "user", content: [media, { type: "text", text: BILL_PROMPT }] }],
    });
    if (resp.stop_reason === "refusal") return { ok: false, code: "declined" };
    const bill = parseBill((resp.content || []).find((b) => b.type === "text")?.text);
    if (!bill) return { ok: false, code: "unreadable" };
    return { ok: true, bill };
  } catch (e) {
    if (e?.status === 401) return { ok: false, code: "auth" };
    if (e?.status === 429) return { ok: false, code: "rate" };
    return { ok: false, code: "failed" };
  }
}

/**
 * What the lead assistant is told when a homeowner sends their bill: a plain
 * statement of what the reader found, marked so the assistant knows it came
 * from the photo and not from the person. Null when nothing usable was read.
 */
export function billFacts(bill) {
  if (!bill || (!bill.monthlyKwh && !bill.amountDue)) return null;
  const parts = [];
  if (bill.monthlyKwh) parts.push(`monthly consumption about ${Math.round(bill.monthlyKwh)} kWh (${Math.round(bill.annualKwh || bill.monthlyKwh * 12)} kWh a year)`);
  if (bill.amountDue) parts.push(`amount due ${Math.round(bill.amountDue)}${bill.currency ? " " + bill.currency : ""}`);
  if (bill.supplier) parts.push(`supplier ${bill.supplier}`);
  return `[Bill photo] The homeowner sent a photo of their electricity bill. The bill reader found: ${parts.join("; ")}.`;
}
