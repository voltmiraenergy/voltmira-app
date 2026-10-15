// lib/reportId.js — the ID printed on every bank document and in the Excel
// model: "VM-20261008-3F9A2C". The date is the day it was made; the six
// characters come from a SHA-256 of the figures the document rests on (the
// plants, the terms, the capex, the loan, the energy, the cover and the NPV),
// so two documents with the same ID show the same numbers, and a changed
// number changes the ID. The bank can quote it, and the installer can tell
// which version of the figures a PDF or workbook came from. Pure.
import { sha256 } from "./sha256.js";

const round = (v, d) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

/** The figures an ID stands for, in a fixed order. */
export function idBasis(model) {
  const a = model?.agg || {};
  return {
    portfolio: model?.portfolio?.id || "",
    assets: (model?.assets || []).map((x) => x.id),
    fin: model?.fin || null,
    scenario: model?.scenario || null,
    capex: round(a.capexEur, 0), loan: round(a.loanEur, 0), mwh: round(a.year1Mwh, 1),
    dscr: [round(a.dscrMin, 3), round(model?.p90?.dscrMin, 3)],
    npv: round(a.npv, 0), irr: round(a.irr, 5),
  };
}

/** @param {object} model  buildModel()  @param {string} dayKey  "YYYY-MM-DD" */
export function reportId(model, dayKey) {
  const day = String(dayKey || "").replace(/-/g, "").slice(0, 8) || "00000000";
  return `VM-${day}-${sha256(JSON.stringify(idBasis(model))).slice(0, 6).toUpperCase()}`;
}
