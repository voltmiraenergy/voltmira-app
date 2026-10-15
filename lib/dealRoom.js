// lib/dealRoom.js — the deal room of a plant: its documents filed under the
// permit checklist's items, the read-only links a bank opens without an
// account, the bank's questions on an item, and the log of what was opened.
// Pure; no I/O. The tables and the private bucket are
// supabase/add-deal-room.sql; the bank's side is lib/dealLoad.js and the
// routes under /d and /api/deal; the installer's side is
// components/portfolio/DealRoom.jsx and ItemFiles.jsx.
import { PERMITS } from "./plantPermits.js";
import { plt } from "./plantText.js";

/** The private Storage bucket. Path: <company>/<portfolio>/<plant>/<item>/<nonce>-<file>. */
export const DEAL_BUCKET = "deal-docs";
/** One file at most, the bucket's own limit. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** The checklist items a document or a question is filed under, and "other". */
export const ITEM_IDS = [...PERMITS.map((p) => p.id), "other"];
/** How long a link stays open, days. */
export const EXPIRY_DAYS = [7, 14, 30, 60, 90];
export const DEFAULT_EXPIRY_DAYS = 30;
/** The bank's page and pack: formal Romanian or English. */
export const LINK_LANGS = ["ro", "en"];
/** Suggestions for the bank's name; any name can be typed. */
export const BANK_SUGGESTIONS = ["MAIB", "OTP Bank", "Victoriabank", "Moldindconbank", "ProCredit Bank"];
export const MAX_QUESTION = 2000;
export const MAX_ANSWER = 4000;

// what a lender's documents usually are: papers, scans, sheets, site files
const TYPES = {
  pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain",
  zip: "application/zip",
  kml: "application/vnd.google-earth.kml+xml", kmz: "application/vnd.google-earth.kmz",
};
/** Every content type the bucket accepts (the SQL lists the same). */
export const ALLOWED_TYPES = [...new Set(Object.values(TYPES))];
export const ACCEPT = Object.keys(TYPES).map((e) => "." + e).join(",");

/** A file's type from its name, or null when the deal room does not take it. */
export function fileType(name) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name || ""));
  const ext = m ? m[1].toLowerCase() : "";
  return TYPES[ext] ? { ext, mime: TYPES[ext] } : null;
}

/** Whether a picked file can be filed: its type, and its size within the limit. */
export function checkUpload({ name, size }) {
  const type = fileType(name);
  if (!type) return { ok: false, error: "type" };
  if (!(size > 0)) return { ok: false, error: "empty" };
  if (size > MAX_FILE_BYTES) return { ok: false, error: "size" };
  return { ok: true, mime: type.mime };
}

/** A Storage-safe form of a name: Latin letters, digits, dot, dash and underscore (diacritics dropped), the extension kept. */
export function safeName(name, fallback = "document") {
  const raw = String(name || "");
  const t = fileType(raw);
  const stem = t ? raw.slice(0, -(t.ext.length + 1)) : raw;
  const s = stem.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 90) || fallback;
  return t ? `${s}.${t.ext}` : s;
}

/** Where a document lives in the bucket; the first folder is the company, as the Storage policies require. */
export function docPath({ companyId, portfolioId, plantId, itemId, fileName, nonce }) {
  if (!ITEM_IDS.includes(itemId)) throw new Error("item");
  return [companyId, portfolioId, safeName(plantId, "plant"), itemId, `${String(nonce).replace(/[^a-z0-9]/gi, "").slice(0, 16)}-${safeName(fileName)}`].join("/");
}

/** A link's token: 32 to 64 URL-safe characters. */
export const isToken = (s) => /^[A-Za-z0-9_-]{32,64}$/.test(String(s || ""));

/** open, expired or revoked */
export function linkState(link, now = Date.now()) {
  if (!link) return "missing";
  if (link.revoked_at) return "revoked";
  return new Date(link.expires_at).getTime() > now ? "active" : "expired";
}

/** The expiry of a link opened now for `days`, as an ISO time. */
export function expiryFrom(days, now = Date.now()) {
  const d = EXPIRY_DAYS.includes(Number(days)) ? Number(days) : DEFAULT_EXPIRY_DAYS;
  return new Date(now + d * 86400000).toISOString();
}

/** The bank's name as typed: trimmed, one line, at most 80 characters. */
export const cleanBank = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 80);

/** The bank's question, checked: the item it concerns, who asks (optional) and the text. */
export function cleanQuestion({ item, name, body } = {}) {
  const text = String(body || "").replace(/\r\n?/g, "\n").trim();
  if (!ITEM_IDS.includes(item)) return { ok: false, error: "item" };
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MAX_QUESTION) return { ok: false, error: "long" };
  return { ok: true, item, name: String(name || "").replace(/\s+/g, " ").trim().slice(0, 120), body: text };
}

/** Documents per checklist item, in checklist order, oldest first within an item. */
export function docsByItem(docs = []) {
  const out = Object.fromEntries(ITEM_IDS.map((k) => [k, []]));
  for (const d of docs) if (out[d.item_id]) out[d.item_id].push(d);
  for (const k of ITEM_IDS) out[k].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return out;
}

/** How many documents each item has. */
export function docCounts(docs = []) {
  const out = {};
  for (const d of docs) if (ITEM_IDS.includes(d.item_id)) out[d.item_id] = (out[d.item_id] || 0) + 1;
  return out;
}

/** Questions per item, newest first, and how many still wait for an answer. */
export function questionsByItem(qs = []) {
  const out = Object.fromEntries(ITEM_IDS.map((k) => [k, []]));
  for (const q of qs) if (out[q.item_id]) out[q.item_id].push(q);
  for (const k of ITEM_IDS) out[k].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const open = qs.filter((q) => ITEM_IDS.includes(q.item_id) && !isAnswered(q)).length;
  return { byItem: out, open };
}
export const isAnswered = (q) => !!(q && (String(q.answer || "").trim() || q.answer_doc_id));

const slug = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** The folder of an item inside the pack: "05-documents/04-grid-connection". */
export function itemFolder(itemId) {
  const n = ITEM_IDS.indexOf(itemId) + 1;
  return `05-documents/${String(n).padStart(2, "0")}-${slug(plt("pm_" + itemId, "en")) || itemId}`;
}

/**
 * The documents' paths inside the pack, one folder per checklist item; a name
 * used twice in a folder gets " (2)", " (3)" before its extension.
 * @param {{item_id:string, name:string}[]} docs
 * @returns {string[]} one path per document, in the same order
 */
export function packPaths(docs = []) {
  const used = new Set();
  return docs.map((d) => {
    const folder = itemFolder(ITEM_IDS.includes(d.item_id) ? d.item_id : "other");
    const base = safeName(d.name);
    const m = /^(.*?)(\.[a-z0-9]{1,5})?$/i.exec(base);
    let p = `${folder}/${base}`;
    for (let k = 2; used.has(p.toLowerCase()); k++) p = `${folder}/${m[1]} (${k})${m[2] || ""}`;
    used.add(p.toLowerCase());
    return p;
  });
}

/**
 * The access log, per link: how many visits (distinct visitors a day), the
 * first and the last time, and what was opened.
 * @param {object[]} views  deal_views rows
 */
export function viewSummary(views = []) {
  const out = {};
  for (const v of views) {
    const k = v.link_id || "";
    const s = out[k] || (out[k] = { opens: 0, documents: 0, packs: 0, questions: 0, first: null, last: null, visits: new Set() });
    if (v.what === "open") s.opens += 1;
    if (v.what === "document") s.documents += 1;
    if (v.what === "pack") s.packs += 1;
    if (v.what === "question") s.questions += 1;
    s.visits.add(`${v.visitor || ""}|${String(v.at || "").slice(0, 10)}`);
    if (!s.first || v.at < s.first) s.first = v.at;
    if (!s.last || v.at > s.last) s.last = v.at;
  }
  for (const k of Object.keys(out)) out[k].visits = out[k].visits.size;
  return out;
}

/** A size for people: 820 KB, 3.4 MB. */
export function sizeText(bytes, lang = "en") {
  const b = Number(bytes) || 0;
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-IE";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024)).toLocaleString(loc)} KB`;
  return `${(b / (1024 * 1024)).toLocaleString(loc, { maximumFractionDigits: 1 })} MB`;
}
