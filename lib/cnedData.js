// lib/cnedData.js — CNED's register of installed renewable capacity, as the
// app uses it: the switch that keeps it local, and the figures every surface
// derives from the monthly snapshot (lib/data/cnedEser.js).
//
// THE SWITCH. CNED's site says "All rights reserved" and states no licence for
// its data, so nothing from it is shown until CNED confirms in writing that
// VoltMira may reuse it. Until then CNED_DATA=on is set only on the owner's
// machine (.env.local); production has no such variable, so every surface
// renders nothing from CNED there, and /api/cned answers 404.
//
// SERVER ONLY. The snapshot is imported here and nowhere else; client
// components get what they need as props or from /api/cned, and only while
// the switch is on (lib/cnedData.test.js fails if a "use client" file imports
// the snapshot, which would ship it to every visitor).
//
// The derived figures live in lib/cnedStats.js (pure, no data, safe in the
// browser) and are re-exported here for server code.
import { CNED_ESER } from "./data/cnedEser.js";
export { raionStats, nationalTotals, marketSummary, raionBrief, raionFor, regionalContext, UNCOVERED } from "./cnedStats.js";

export const cnedEnabled = (env = process.env) => String(env.CNED_DATA || "").toLowerCase() === "on";

/** The snapshot while the switch is on, else null. */
export const cnedSnapshot = (env = process.env) => (cnedEnabled(env) ? CNED_ESER : null);
