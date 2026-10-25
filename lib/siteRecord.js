// lib/siteRecord.js — what the crew records on site for a won job (the quote's "On site" card, SiteRecord.jsx): the
// checklist, the serial numbers of what was fitted, and the client's signature at handover. Filled in on a phone,
// often with no signal: the device keeps its copy with the version it started from, and when it reaches the server
// the two are merged item by item (a teammate's changes meanwhile are kept; where both changed the same thing, the
// later one wins and the person is told). Pure, no I/O. The photos are separate (job_photos).

export const FIELD_ITEMS = ["arrive", "mount", "dc", "ac", "earthing", "test", "labels", "cleanup"];
export const SERIAL_KINDS = ["panel", "inverter", "battery", "meter"];
export const PHOTO_SLOTS = ["roof", "array", "inverter", "board", "meter", "labels"];

export const emptyRecord = () => ({ checklist: {}, serials: { panel: [], inverter: [], battery: [], meter: [] }, signature: null });

/** A record as stored or as sent, made safe: known items only, serials cleaned, a signature that is a PNG. */
export function cleanRecord(r) {
  const out = emptyRecord();
  for (const k of FIELD_ITEMS) {
    const v = r?.checklist?.[k];
    if (v && typeof v === "object" && typeof v.at === "string") out.checklist[k] = { at: v.at.slice(0, 30), by: String(v.by || "").slice(0, 80) };
  }
  for (const k of SERIAL_KINDS) out.serials[k] = cleanSerials(r?.serials?.[k]);
  const s = r?.signature;
  if (s && typeof s.png === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.png) && s.png.length < 300_000) {
    out.signature = { png: s.png, name: String(s.name || "").slice(0, 120), at: String(s.at || "").slice(0, 30) };
  }
  return out;
}

/** Serial numbers from a list or from text (one per line, or separated by commas): trimmed, upper case, no repeats. */
export function cleanSerials(v) {
  const list = Array.isArray(v) ? v : String(v || "").split(/[\n,;]+/);
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const s = String(x || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!s || s.length > 60 || seen.has(s)) continue;
    seen.add(s); out.push(s);
    if (out.length >= 300) break;
  }
  return out;
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const later = (a, b) => (String(a?.at || "") >= String(b?.at || "") ? a : b);

/**
 * Three-way merge: the server's record now, the one the device started from, and the device's.
 * @returns {{ record: object, conflicts: string[] }}  conflicts: what both changed differently ("checklist.mount",
 *   "signature"); for each, the later change was kept
 */
export function mergeRecord(server, base, mine) {
  const S = cleanRecord(server), B = cleanRecord(base), M = cleanRecord(mine);
  const out = emptyRecord();
  const conflicts = [];
  for (const k of FIELD_ITEMS) {
    const s = S.checklist[k], b = B.checklist[k], m = M.checklist[k];
    const mineChanged = !same(m, b), serverChanged = !same(s, b);
    let v;
    if (mineChanged && serverChanged && !same(m, s)) {
      conflicts.push("checklist." + k);
      // a tick against an untick: the tick stands (work done is not undone by a stale phone)
      v = m && s ? later(m, s) : m || s;
    } else v = mineChanged ? m : s;
    if (v) out.checklist[k] = v;
  }
  for (const k of SERIAL_KINDS) {
    const s = S.serials[k], b = new Set(B.serials[k]), m = M.serials[k];
    const removedByMe = [...b].filter((x) => !m.includes(x));
    const added = m.filter((x) => !b.has(x));
    // the server's list, less what this device removed, plus what it added
    out.serials[k] = cleanSerials([...s.filter((x) => !removedByMe.includes(x)), ...added]);
  }
  const ms = !same(M.signature, B.signature), ss = !same(S.signature, B.signature);
  if (ms && ss && !same(M.signature, S.signature)) {
    conflicts.push("signature");
    out.signature = M.signature && S.signature ? later(M.signature, S.signature) : M.signature || S.signature;
  } else out.signature = ms ? M.signature : S.signature;
  return { record: out, conflicts };
}

/** How complete the record is, for the board and the handover: items done, serials typed, signed. */
export function recordProgress(r) {
  const c = cleanRecord(r);
  return {
    done: FIELD_ITEMS.filter((k) => c.checklist[k]).length, total: FIELD_ITEMS.length,
    serials: SERIAL_KINDS.reduce((n, k) => n + c.serials[k].length, 0), signed: !!c.signature,
  };
}
