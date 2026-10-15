// lib/gridFile.js — the grid-connection file of a quote, whichever country it
// is in: Moldova's two operators and five stages (lib/mdGrid.js), or Ukraine's
// oblenergos and the green-tariff stages (lib/uaGrid.js). Pure; no I/O.
import { OPERATORS, GRID_STAGES, suggestOperator } from "./mdGrid.js";
import { UA_OPERATORS, UA_GRID_STAGES, suggestUaOperator } from "./uaGrid.js";

/** The market's operators, stages and address-based suggestion, or null for a market with no file. */
export function gridFor(market) {
  if (market === "UA") return { market: "UA", operators: UA_OPERATORS, stages: UA_GRID_STAGES, suggest: suggestUaOperator };
  if (market === "MD") return { market: "MD", operators: OPERATORS, stages: GRID_STAGES, suggest: suggestOperator };
  return null;
}
