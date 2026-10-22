// lib/gridPower.js — the generating power a Moldovan connection file states, and the checks made
// before it is filed. Pure.
//
// One figure goes on both operators' forms: what the installation can put on the line, which is its
// inverters' AC power (RED Nord's form asks for "the maximum production power"). RED Nord's form
// printed the inverter's AC power while Premier's printed the panels' DC power, so the same job
// stated two different powers to the two operators. The system size is the fallback when the bill of
// materials names no inverter.
//
// The checks come from the application form itself (RED Nord, "Cerere pentru emiterea avizului de
// racordare a centralelor electrice", ftp.rednord.md/files/supply/cerere_producere.pdf): "Centrala
// electrică trebuie să dispună de o putere instalată de până la 200 kW, dar nu mai mare decât puterea
// contractată cu furnizorul pentru locul de consum respectiv".
import { designCheck } from "./designCheck.js";

/** The prosumer form's ceiling on installed power, kW. */
export const PROSUMER_FORM_MAX_KW = 200;

/**
 * @param {object} project  a projects row (kw, bom, batt, batt_kwh)
 * @returns {{ kw: number, fromInverter: boolean, dcKw: number, phases: number|null }}
 */
export function productionPower(project) {
  const dcKw = Number(project?.kw) || 0;
  const bom = Array.isArray(project?.bom) ? project.bom : [];
  const dc = designCheck({ bom, kw: dcKw, battKwh: project?.batt ? Number(project.batt_kwh) || 0 : 0, market: "MD" });
  const known = Boolean(dc.fromBom?.inverter) && Number(dc.acKw) > 0;
  return { kw: known ? Math.round(dc.acKw * 100) / 100 : dcKw, fromInverter: known, dcKw, phases: known ? dc.ph : null };
}

/**
 * What stops the file, and what only deserves a word, before it goes to the operator.
 * @param {object} a
 * @param {number} a.installedKw
 * @param {number|null} [a.contractedKw]  the power contracted with the supplier for the site
 * @param {number|null} [a.ceilingKw]     the household prosumer limit set in the workspace
 * @param {"person"|"company"} [a.kind]
 * @returns {{ blocks: string[], warns: string[] }}  codes: over_form_max, over_contracted, over_household_ceiling; contracted_missing
 */
export function powerIssues({ installedKw, contractedKw = null, ceilingKw = null, kind = "person" } = {}) {
  const kw = Number(installedKw) || 0, blocks = [], warns = [];
  if (kw > PROSUMER_FORM_MAX_KW) blocks.push("over_form_max");
  if (Number(contractedKw) > 0) { if (kw > Number(contractedKw) + 1e-9) blocks.push("over_contracted"); }
  else warns.push("contracted_missing");
  if (kind === "person" && Number(ceilingKw) > 0 && kw > Number(ceilingKw) + 1e-9) blocks.push("over_household_ceiling");
  return { blocks, warns };
}
