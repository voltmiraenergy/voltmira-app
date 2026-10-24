// lib/nearbyServer.js — the systems VoltMira monitors, with their place and their last 12 months of readings, for
// "Proof from nearby systems" on the client's offer (lib/nearbyProof.js decides what may be shown). Read with the
// service role across every workspace, because the figure is an anonymous district median; nothing about any one
// system leaves this file. Kept in memory for an hour: readings arrive once a month. Server only.
import { nearbyProof, lastTwelveMonths } from "./nearbyProof.js";
import { raionFor } from "./cnedStats.js";
import { SHAPES } from "./data/mdRaionShapes.js";

const TTL = 60 * 60 * 1000;
let memo = { at: 0, systems: null };
const districtOf = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon) ? raionFor(lat, lon, SHAPES) : null);

async function monitoredSystems(db, now) {
  if (memo.systems && now - memo.at < TTL) return memo.systems;
  const months = lastTwelveMonths(new Date(now));
  const { data: reads, error } = await db.from("production_readings")
    .select("project_id, month, kwh").gte("month", months[0] + "-01").lte("month", months[11] + "-28").limit(50000);
  if (error) return [];
  const byProject = new Map();
  for (const r of reads || []) {
    if (!byProject.has(r.project_id)) byProject.set(r.project_id, []);
    byProject.get(r.project_id).push({ month: String(r.month).slice(0, 7), kwh: Number(r.kwh) });
  }
  // only systems with a full year can count; ask for those projects alone
  const ids = [...byProject].filter(([, rs]) => rs.length >= 12).map(([id]) => id);
  const systems = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data: rows } = await db.from("projects").select("id, company_id, kw, lat, lon, sample").in("id", ids.slice(i, i + 500));
    for (const p of rows || []) {
      const lat = Number(p.lat), lon = Number(p.lon);
      systems.push({ companyId: p.company_id, kw: Number(p.kw), lat, lon, sample: !!p.sample, district: districtOf(lat, lon), readings: byProject.get(p.id) || [] });
    }
  }
  memo = { at: now, systems };
  return systems;
}

/**
 * The proof for the district a place lies in, or null.
 * @returns {Promise<{district:string, systems:number, kwhPerKwp:number, from:string, to:string}|null>}
 */
export async function nearbyFor(db, { lat, lon }, now = Date.now()) {
  const district = districtOf(Number(lat), Number(lon));
  if (!district) return null;
  try {
    const systems = await monitoredSystems(db, now);
    return nearbyProof(district, systems, (a, b) => districtOf(a, b), new Date(now));
  } catch {
    return null;
  }
}
