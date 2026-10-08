// lib/studyReader.js — read an independent energy yield study (wind or solar)
// with Claude, for the plant editor (app/api/plant-study). The model only
// transcribes: for every figure it gives the page and a verbatim quote, and
// this file checks each one before anyone sees it (is the quote on that page,
// is the number in the quote, is the unit known, is P90 below P50, is the
// capacity factor plausible, is the study for the same plant size). Nothing
// is applied here: the user reviews every value and ticks what to use.
//
// The text path sends only the pages the browser picked (lib/studyPages.js);
// a scan is sent as a small PDF of the pages the user chose. Server-only for
// readStudy(); the checks are pure.
import { pagesText, quoteOnPage, valueInQuote } from "./studyPages.js";

export const STUDY_MODEL = () => process.env.STUDY_EXTRACT_MODEL || "claude-opus-5";
/** A scan's chosen pages, as a PDF, before base64 (the request must stay under 4.5 MB). */
export const STUDY_MAX_PDF_BYTES = 3 * 1024 * 1024;

const nullable = (t) => ({ anyOf: [{ type: t }, { type: "null" }] });
const cite = { page: nullable("integer"), quote: { type: "string" } };
const field = (value) => ({ type: "object", additionalProperties: false, required: ["value", "page", "quote"], properties: { value, ...cite } });
const energy = {
  type: "object", additionalProperties: false, required: ["value", "unit", "page", "quote"],
  properties: { value: nullable("number"), unit: { type: "string", enum: ["MWh", "GWh", "kWh", "none"] }, ...cite },
};

/** The answer's shape (structured output): every figure with the page and words it was read from. */
export const STUDY_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["is_yield_study", "technology", "p50", "p90_1y", "p90_10y", "capacity_mw", "turbines", "hub_height_m", "mean_wind_ms",
    "losses_pct", "uncertainty_pct", "turbine_model", "prepared_by", "report_date", "measurement", "notes"],
  properties: {
    is_yield_study: { type: "boolean" },
    technology: { type: "string", enum: ["wind", "solar", "hybrid", "other"] },
    p50: energy, p90_1y: energy, p90_10y: energy,
    capacity_mw: field(nullable("number")), turbines: field(nullable("number")), hub_height_m: field(nullable("number")),
    mean_wind_ms: field(nullable("number")), losses_pct: field(nullable("number")), uncertainty_pct: field(nullable("number")),
    turbine_model: field(nullable("string")), prepared_by: field(nullable("string")), report_date: field(nullable("string")),
    measurement: field(nullable("string")),
    notes: { type: "string" },
  },
};

const LANG_NAME = { en: "English", ro: "Romanian", ru: "Russian", uk: "Ukrainian" };

/** What the reader is asked. `scan`: the pages come as a PDF numbered from 1, not as marked text. */
export function studyPrompt(kind, { scan = false, lang = "en" } = {}) {
  const tech = kind === "solar" ? "solar" : "wind";
  return `You are reading an independent energy yield assessment for a ${tech} plant, for a bank that will lend on it. The text may be in English, Romanian, Russian or Ukrainian.
Extract the values for the ${tech} part only. Transcribe exactly what is printed: never compute, estimate, round or convert a number yourself.
- p50: the NET annual energy at P50 (after all losses), as the long-term annual average, with its unit as printed. If gross and net are both printed, use net.
- p90_1y: the net P90 for a 1-year horizon. p90_10y: the net P90 for a 10-year horizon. If one P90 is printed without a horizon, put it in p90_1y and say so in notes.
- capacity_mw: the installed ${tech === "solar" ? "DC capacity in MWp" : "capacity in MW"} the figures are for.
- turbines, hub_height_m, mean_wind_ms (long-term mean wind speed at hub height), turbine_model: ${tech === "wind" ? "as printed" : "null for a solar study"}.
- losses_pct: the total losses in %. uncertainty_pct: the total uncertainty for one year in %.
- prepared_by: the consultant or company that wrote the study. report_date: the date of the report, as YYYY-MM-DD when the full date is printed, otherwise as printed.
- measurement: a short phrase on the on-site measurement (mast or lidar, height, months), as printed, or null.
For every value give the page it is printed on${scan ? " (pages are numbered from 1 in the order of this document)" : " (the number in the \"=== Page N ===\" marker above it)"} and a verbatim quote of 5 to 15 words copied exactly from that page that contains the number or the words. A value that is not printed: value null, page null, quote "".
is_yield_study: false when the document is not an energy yield assessment.
notes: one or two sentences a lender should know (for example: the P90 horizon is not stated; the figures are for another layout; the study is a draft), written in ${LANG_NAME[lang] || "English"}.`;
}

const pos = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const TO_MWH = { MWh: 1, GWh: 1000, kWh: 0.001 };

/** Usual net capacity factors; outside them the unit or the page was probably misread. */
export const CF_RANGE = { wind: [0.12, 0.6], solar: [0.08, 0.3] };

/**
 * The reader's answer, checked. Each field comes back as { value, page, quote, check }:
 * check is "verified" (the quote is on that page and holds the number), "quote_only"
 * (the quote is on the page, the number is not in it), "unverified" (the quote is not
 * on the page), or "scan" (read from an image, nothing to compare against).
 * @param {object} raw            the model's JSON
 * @param {object} ctx
 * @param {"wind"|"solar"} ctx.kind
 * @param {Record<number,string>|null} ctx.texts  page number -> text sent; null for a scan
 * @param {number[]} [ctx.pageMap]  for a scan: the original page of each page sent
 * @param {{mw?:number}} [ctx.plant] the plant's capacity of this kind, MW (MWp for solar)
 */
export function checkStudy(raw, { kind, texts = null, pageMap = null, plant = {} }) {
  if (!raw || typeof raw !== "object") return { ok: false, code: "unreadable" };
  const scan = !texts;
  const pageOf = (p) => {
    const n = Number.isInteger(p) ? p : null;
    if (n == null) return null;
    if (scan) return pageMap && pageMap[n - 1] ? pageMap[n - 1] : null;
    return Object.prototype.hasOwnProperty.call(texts, n) ? n : null;
  };
  const one = (f, value, { number = true } = {}) => {
    const page = pageOf(f?.page);
    const quote = String(f?.quote || "").slice(0, 240);
    let check = "scan";
    if (!scan) {
      const on = page != null && quoteOnPage(quote, texts[page]);
      check = !on ? "unverified" : number && !valueInQuote(f?.value, quote) ? "quote_only" : "verified";
    }
    return { value, page, quote, check };
  };
  const energyOf = (f) => {
    const v = pos(f?.value);
    const k = TO_MWH[f?.unit];
    return v != null && k ? one(f, Math.round(v * k * 1000) / 1000) : null;
  };
  const numOf = (f, lo, hi) => {
    const v = pos(f?.value);
    return v != null && v >= lo && v <= hi ? one(f, v) : null;
  };
  const textOf = (f, max = 120) => (f?.value ? one(f, String(f.value).trim().slice(0, max), { number: false }) : null);

  const p50 = energyOf(raw.p50);
  if (!p50) return { ok: false, code: raw.is_yield_study === false ? "not_study" : "no_p50" };
  const warnings = [];
  let p90_1y = energyOf(raw.p90_1y), p90_10y = energyOf(raw.p90_10y);
  if ((p90_1y && p90_1y.value > p50.value) || (p90_10y && p90_10y.value > p50.value)) {
    warnings.push({ id: "p90_high" });
    if (p90_1y && p90_1y.value > p50.value) p90_1y = null;
    if (p90_10y && p90_10y.value > p50.value) p90_10y = null;
  }
  const fields = {
    p50, p90_1y, p90_10y,
    capacity: numOf(raw.capacity_mw, 0.01, 5000),
    turbines: kind === "wind" ? numOf(raw.turbines, 1, 1000) : null,
    hub: kind === "wind" ? numOf(raw.hub_height_m, 20, 300) : null,
    meanWind: kind === "wind" ? numOf(raw.mean_wind_ms, 1, 20) : null,
    losses: numOf(raw.losses_pct, 0.1, 60),
    uncertainty: numOf(raw.uncertainty_pct, 0.1, 60),
    model: kind === "wind" ? textOf(raw.turbine_model) : null,
    by: textOf(raw.prepared_by),
    date: textOf(raw.report_date, 40),
    measurement: textOf(raw.measurement, 160),
  };
  if (fields.turbines) fields.turbines.value = Math.round(fields.turbines.value);
  // a date the plant can store: only a full ISO date
  const iso = fields.date && /^\d{4}-\d{2}-\d{2}$/.test(fields.date.value) ? fields.date.value : null;

  // does it fit this plant
  if (raw.technology && raw.technology !== kind && raw.technology !== "hybrid") warnings.push({ id: "tech", tech: raw.technology });
  const planned = pos(plant?.mw);
  if (fields.capacity && planned && Math.abs(fields.capacity.value - planned) / planned > 0.03) warnings.push({ id: "cap", study: fields.capacity.value, plant: planned });
  const capMw = fields.capacity?.value || planned;
  if (capMw) {
    const cf = p50.value / (capMw * 8760);
    const [lo, hi] = CF_RANGE[kind] || CF_RANGE.wind;
    if (cf < lo || cf > hi) warnings.push({ id: "cf", cf, lo, hi });
  }
  const unchecked = Object.values(fields).filter((f) => f && (f.check === "unverified" || f.check === "quote_only")).length;
  if (unchecked) warnings.push({ id: "unchecked", n: unchecked });
  if (!p90_1y && !p90_10y) warnings.push({ id: "no_p90" });
  return {
    ok: true,
    study: { kind, fields, isoDate: iso, technology: raw.technology || "", notes: String(raw.notes || "").slice(0, 400), warnings, scan },
  };
}

/**
 * Read one study.
 * @param {{ messages: { create: Function } }} client  an Anthropic client
 * @param {object} a
 * @param {"wind"|"solar"} a.kind
 * @param {Array<{n:number,text:string}>} [a.pages]  the picked pages' text
 * @param {string} [a.pdf]       base64 of a scan's chosen pages
 * @param {number[]} [a.pageMap] the original page of each page in `pdf`
 * @param {string} [a.fileName]
 * @param {{mw?:number}} [a.plant]
 * @param {string} [a.lang]      the language of the reader's notes
 * @returns {Promise<{ok:true, study:object} | {ok:false, code:string}>}
 */
export async function readStudy(client, { kind, pages = null, pdf = null, pageMap = null, fileName = "", plant = {}, lang = "en", model = STUDY_MODEL() }) {
  const scan = !pages;
  if (scan && !pdf) return { ok: false, code: "unreadable" };
  if (scan && Buffer.byteLength(pdf, "base64") > STUDY_MAX_PDF_BYTES) return { ok: false, code: "too_large" };
  const doc = scan
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf }, title: fileName.slice(0, 120) || undefined }
    : { type: "document", source: { type: "text", media_type: "text/plain", data: pagesText(pages) }, title: fileName.slice(0, 120) || undefined };
  try {
    const resp = await client.messages.create({
      model, max_tokens: 4000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: STUDY_SCHEMA } },
      messages: [{ role: "user", content: [doc, { type: "text", text: studyPrompt(kind, { scan, lang }) }] }],
    });
    if (resp.stop_reason === "refusal") return { ok: false, code: "declined" };
    if (resp.stop_reason === "max_tokens") return { ok: false, code: "unreadable" };
    const text = (resp.content || []).find((b) => b.type === "text")?.text;
    let raw; try { raw = JSON.parse(text); } catch { return { ok: false, code: "unreadable" }; }
    const texts = scan ? null : Object.fromEntries(pages.map((p) => [p.n, p.text]));
    return checkStudy(raw, { kind, texts, pageMap, plant });
  } catch (e) {
    if (e?.status === 401) return { ok: false, code: "auth" };
    if (e?.status === 429 || e?.status === 529) return { ok: false, code: "rate" };
    if (e?.status === 413 || (e?.status === 400 && /too (long|large)|exceed/i.test(String(e?.message || "")))) return { ok: false, code: "too_large" };
    return { ok: false, code: "failed" };
  }
}
