// lib/preflightText.js — a pre-send finding (lib/preflight.js) as a sentence,
// in the reader's language. The words are lib/bankText.js pf_*. Pure.
import { bt } from "./bankText.js";
import { plt } from "./plantText.js";
import { num } from "./portfolioFormat.js";

/** @param {{id:string, level:string, part?:string, [k:string]:any}} f */
export function checkText(f, lang = "en") {
  const part = f.part ? plt(f.part === "wind" ? "c_wind" : "c_solar", lang) : "";
  switch (f.id) {
    case "cf_range": return bt("pf_cf_range", lang, { part, cf: num(f.cf * 100, lang, 1), lo: num(f.lo * 100, lang, 0), hi: num(f.hi * 100, lang, 0) });
    case "study_vs_public": return bt("pf_study_vs_public", lang, { part, x: num(Math.abs(f.ratio - 1) * 100, lang, 0), dir: bt(f.ratio > 1 ? "pf_above" : "pf_below", lang) });
    case "study_old": return bt("pf_study_old", lang, { part, date: f.date, years: f.years });
    case "dcac_range": return bt("pf_dcac_range", lang, { r: num(f.r, lang, 2), lo: num(f.lo, lang, 1), hi: num(f.hi, lang, 1) });
    case "clip_high": return bt("pf_clip_high", lang, { x: num(f.x, lang, 1) });
    case "dup_file": return bt("pf_dup_file", lang, { name: f.name });
    case "done_no_doc": return bt("pf_done_no_doc", lang, { item: plt("pm_" + f.item, lang) });
    default: return bt("pf_" + f.id, lang, { part });
  }
}
