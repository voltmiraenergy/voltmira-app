// scripts/cned-snapshot.mjs — take this month's snapshot of CNED's public
// register of installed renewable capacity (E-SER) and write it to
// lib/data/cnedEser.js. Run by hand once a month, after CNED refreshes its
// report (it says "cu actualizare lunară a datelor"):
//
//   node scripts/cned-snapshot.mjs
//
// AGGREGATES ONLY. CNED's model also holds producers' names, IDNO, owners'
// names and contacts and EIC codes; this script never selects those columns,
// and lib/cnedData.test.js fails if a name-like field ever reaches the file.
// Plant positions are rounded to 0.01 degree (about 1 km) and merged.
//
// Every figure is CNED's own measure, so the totals match its dashboard
// (https://cned.gov.md/ro/content/capacitati-instalate). Biogas is outside
// VoltMira's scope: it is kept only as "other" so totals add up.
//
// The data is shown in the app only when CNED_DATA=on (lib/cnedData.js),
// until CNED confirms in writing that VoltMira may reuse it.
import fs from "node:fs";
import { publicReport, col, measure, sum, count, inList } from "../lib/powerbi.js";
import { raionId, COVERED } from "../lib/mdRaions.js";

const KEY = "dc2c7f09-2fec-44fe-aed6-de9c97c5f2a4";
const PAGE = "https://cned.gov.md/ro/content/capacitati-instalate";
const pbi = publicReport(KEY);
const D = "DB_SER_FINAL2";
const CUM = "Capacitate Evoluția Cumulată Istorică (kW)";
const TECH = { fotovoltaică: "pv", eoliana: "wind", hidro: "hydro", biogaz: "other" };
const law = (s) => (/160/.test(s) ? "law160" : /tarif fix/i.test(s) ? "fixed_tariff" : /pre[țt] fix/i.test(s) ? "fixed_price" : /liber/i.test(s) ? "free_market" : "other");
const MONTHS = { ianuarie: 1, februarie: 2, martie: 3, aprilie: 4, mai: 5, iunie: 6, iulie: 7, august: 8, septembrie: 9, octombrie: 10, noiembrie: 11, decembrie: 12 };
const r1 = (x) => Math.round(x * 10) / 10;
const kw = (x) => r1(Number(x) || 0);
const num = (x) => Number(x) || 0;
const rid = (name) => { const id = raionId(name); if (!id) throw new Error("unknown raion in CNED data: " + name); return id; };

const meta = await pbi.meta();

// ---- the date the data runs to, from the report's own title ("... la finele lunii august 2026")
const [title] = await pbi.query({ d: D }, [["t", measure("d", "Eticheta Cartoline Titlu Dinamic")]]);
const m = /lunii\s+([a-zăâîșț]+)\s+(\d{4})/i.exec(title?.t || "");
if (!m || !MONTHS[m[1].toLowerCase()]) throw new Error("cannot read the period from: " + title?.t);
const year = +m[2], month = MONTHS[m[1].toLowerCase()];
const dataTo = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
const ym = (y, mo) => `${y}-${String(mo).padStart(2, "0")}`;
const lastYm = ym(year, month);

// ---- plants: area x technology x support scheme, with counts
const plantRows = await pbi.query({ d: D, p: "PRODUCERI_tot" }, [
  ["raion", col("d", "Raion")], ["tech", col("d", "Tipul instalației")], ["law", col("d", "Legea (generalizat)")],
  ["kw", measure("d", CUM)], ["npv", measure("d", "Număr Instalații Fotovoltaice")], ["nw", measure("d", "Număr Instalații eoliene")],
  ["nh", measure("d", "Număr Instalații hidro")], ["nb", measure("d", "Număr Instalații biogaz")],
], [inList(col("p", "Tehnologia"), ["Biogaz", "Hidro", "PV", "Wind"])]);

const raions = Object.fromEntries(COVERED.map((r) => [r.id, {
  plants: { pv: { kw: 0, n: 0 }, wind: { kw: 0, n: 0 }, hydro: { kw: 0, n: 0 }, other: { kw: 0, n: 0 } },
  byScheme: {}, plantsByYear: {},
  prosumers: { kw: 0, n: 0, pf: { kw: 0, n: 0 }, pj: { kw: 0, n: 0 }, cn: { kw: 0, n: 0 }, fn: { kw: 0, n: 0 } },
  prosumersMonthly: [], bess: null,
}]));
const national = { plants: { pv: { kw: 0, n: 0 }, wind: { kw: 0, n: 0 }, hydro: { kw: 0, n: 0 }, other: { kw: 0, n: 0 } }, byScheme: {} };
for (const r of plantRows) {
  const t = TECH[r.tech]; if (!t || !r.raion) continue;
  const id = rid(r.raion), n = num(r.npv) + num(r.nw) + num(r.nh) + num(r.nb), k = num(r.kw);
  for (const into of [raions[id], national]) {
    into.plants[t].kw += k; into.plants[t].n += n;
    if (t !== "other") into.byScheme[law(r.law || "")] = (into.byScheme[law(r.law || "")] || 0) + k;
  }
}

// ---- plants by year end, per area and technology
const plantYears = await pbi.query({ d: D, c: "Calendar_ANI" }, [["yr", col("c", "Anul")], ["raion", col("d", "Raion")], ["tech", col("d", "Tipul instalației")], ["kw", measure("d", CUM)]]);
const yearly = { plants: {}, prosumers: {} };
for (const r of plantYears) {
  const y = +r.yr, t = TECH[r.tech];
  if (!t || t === "other" || !r.raion || y < 2018 || y > year) continue;
  const id = rid(r.raion);
  (raions[id].plantsByYear[y] ||= {})[t] = kw(r.kw);
  const ny = (yearly.plants[y] ||= { pv: 0, wind: 0, hydro: 0 });
  ny[t] = r1(ny[t] + num(r.kw));
}

// ---- plant positions, rounded and merged; biogas left out (scope)
const pts = await pbi.query({ d: D }, [["lat", col("d", "Latitudine")], ["lon", col("d", "Longitudine")], ["tech", col("d", "Tipul instalației")], ["kw", measure("d", CUM)]]);
const merged = new Map(); let unlocatedKw = 0;
for (const r of pts) {
  const t = TECH[r.tech];
  if (!t || t === "other" || !(num(r.kw) > 0)) continue;
  // positions arrive as numbers or as text with a decimal comma, now and then with the two swapped
  let lat = Number(String(r.lat ?? "").replace(",", ".")), lon = Number(String(r.lon ?? "").replace(",", "."));
  if (lat > 26 && lat < 31 && lon > 45 && lon < 49) [lat, lon] = [lon, lat];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 45 || lat > 49 || lon < 26 || lon > 31) { unlocatedKw += num(r.kw); continue; }
  const k = `${lat.toFixed(2)},${lon.toFixed(2)},${t}`;
  const e = merged.get(k) || [+lat.toFixed(2), +lon.toFixed(2), t, 0, 0];
  e[3] += num(r.kw); e[4] += 1; merged.set(k, e);
}
const points = [...merged.values()].map(([la, lo, t, k, n]) => [la, lo, t, kw(k), n]).sort((a, b) => b[3] - a[3]);

// ---- prosumers: area x person type x scheme (net metering CN, net billing FN)
const T = "TableProsumatori";
const prosRows = await pbi.query({ t: T }, [["raion", col("t", "Raion")], ["who", col("t", "Tip persoana (groups)")], ["law", col("t", "Legea (generalizat)")],
  ["kw", measure("t", "Capacitatea Prosumatori (Cumulat)")], ["n", measure("t", "Număr Instalații Prosumatori (Cumulat)")]]);
const natPros = { kw: 0, n: 0, pf: { kw: 0, n: 0 }, pj: { kw: 0, n: 0 }, cn: { kw: 0, n: 0 }, fn: { kw: 0, n: 0 } };
for (const r of prosRows) {
  if (!r.raion) continue;
  const id = rid(r.raion), k = num(r.kw), n = num(r.n);
  const who = /juridic/i.test(r.who || "") ? "pj" : "pf", sch = r.law === "FN" ? "fn" : "cn";
  for (const into of [raions[id].prosumers, natPros]) {
    into.kw += k; into.n += n; into[who].kw += k; into[who].n += n; into[sch].kw += k; into[sch].n += n;
  }
}

// ---- prosumers by year end, by scheme
const prosYears = await pbi.query({ t: T, c: "Calendar_ANI" }, [["yr", col("c", "Anul")], ["law", col("t", "Legea (generalizat)")],
  ["kw", measure("t", "Capacitatea Prosumatori (Cumulat)")], ["n", measure("t", "Număr Instalații Prosumatori (Cumulat)")]]);
for (const r of prosYears) {
  const y = +r.yr; if (y < 2018 || y > year) continue;
  (yearly.prosumers[y] ||= {})[r.law === "FN" ? "fn" : "cn"] = { kw: kw(r.kw), n: num(r.n) };
}

// ---- prosumers month by month per area, the last 25 months (for 12-month growth)
const prosMonths = await pbi.query({ t: T, c: "Calendar_ANI" }, [["an", col("c", "An")], ["luna", col("c", "Luna")], ["raion", col("t", "Raion")],
  ["kw", measure("t", "Capacitatea Prosumatori (Cumulat)")], ["n", measure("t", "Număr Instalații Prosumatori (Cumulat)")]]);
const first = new Date(Date.UTC(year, month - 25, 1));
const firstYm = ym(first.getUTCFullYear(), first.getUTCMonth() + 1);
for (const r of prosMonths) {
  if (!r.raion) continue;
  const p = ym(+r.an, parseInt(r.luna, 10));
  if (p < firstYm || p > lastYm) continue;
  raions[rid(r.raion)].prosumersMonthly.push([p, kw(r.kw), num(r.n)]);
}
for (const v of Object.values(raions)) v.prosumersMonthly.sort((a, b) => a[0].localeCompare(b[0]));

// ---- battery storage connected to the grid
const bessRows = await pbi.query({ b: "BESS4" }, [["raion", col("b", "Raion")], ["yr", col("b", "Anul punerii în funcțiune")],
  ["kwh", sum("b", "Capacitatea de stocare a instalației (kWh)")], ["kw", sum("b", "Puterea de injecție (kW)")], ["n", count("b", "#")]]);
const bess = { kwh: 0, kw: 0, n: 0, years: [] };
for (const r of bessRows) {
  if (!r.raion) continue;
  const id = rid(r.raion), y = r.yr ? new Date(r.yr).getUTCFullYear() : null;
  const b = (raions[id].bess ||= { kwh: 0, kw: 0, n: 0 });
  b.kwh += num(r.kwh); b.kw += num(r.kw); b.n += num(r.n);
  bess.kwh += num(r.kwh); bess.kw += num(r.kw); bess.n += num(r.n);
  if (y && !bess.years.includes(y)) bess.years.push(y);
}

// ---- energy produced (kWh in the report, MWh here) and renewables' share of consumption
const YEARS = ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
const prodRows = await pbi.query({ i: "Indicatori1 (11)" }, [["k", col("i", "Producere de E-SER în RM")], ...YEARS.map((y) => [y, col("i", y)])]);
const PROD = [[/eolien/i, "wind"], [/fotovolta/i, "pv"], [/hidro/i, "hydro"], [/prosumator/i, "prosumers"], [/toate/i, "all"]];
const production = {};
for (const r of prodRows) {
  const key = PROD.find(([re]) => re.test(r.k || ""))?.[1];
  if (!key) continue; // biogas: out of scope, inside "all"
  for (const y of YEARS) if (r[y] != null && r[y] !== "") (production[y] ||= {})[key] = Math.round(Number(r[y]) / 1000);
}
const shareRows = await pbi.query({ i: "Indicatori1 (12)" }, [["k", col("i", "Ponderea de producere a E-SER mixul elecectric în RM")], ...YEARS.map((y) => [y, col("i", y)])]);
const resSharePct = {};
for (const y of YEARS) { const v = shareRows[0]?.[y]; if (v != null && v !== "") resSharePct[y] = Math.round(Number(v) * 1000) / 10; }

// ---- tidy and write
const tidy = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "number" ? r1(v) : v)));
for (const v of Object.values(raions)) if (v.bess) v.bess = tidy(v.bess);
const snapshot = tidy({
  source: { publisher: "CNED", title: "Capacități instalate E-SER", url: PAGE, dataTo, refreshed: (meta.refreshed || "").slice(0, 10) || null, taken: new Date().toISOString().slice(0, 10) },
  national: { plants: national.plants, byScheme: national.byScheme, prosumers: natPros, bess, unlocatedKw },
  yearly, production, resSharePct, raions, points,
});

// the dashboard's own totals, checked before anything is written
const plantKw = ["pv", "wind", "hydro", "other"].reduce((s, t) => s + snapshot.national.plants[t].kw, 0);
console.log("data to", dataTo, "| plants", r1(plantKw), "kW,", ["pv", "wind", "hydro", "other"].reduce((s, t) => s + snapshot.national.plants[t].n, 0), "installations | prosumers", snapshot.national.prosumers.kw, "kW,", snapshot.national.prosumers.n, "| storage", bess.kwh, "kWh |", points.length, "points");
const out = `// lib/data/cnedEser.js — GENERATED by scripts/cned-snapshot.mjs on ${snapshot.source.taken}; do not edit.
// CNED, "Capacități instalate E-SER", data to ${dataTo}. Aggregates only: no names,
// IDNO, contacts or EIC codes. Shown only when CNED_DATA=on (lib/cnedData.js).
// Server-only: import it through lib/cnedData.js, never from a "use client" file.
export const CNED_ESER = ${JSON.stringify(snapshot)};
`;
fs.writeFileSync(new URL("../lib/data/cnedEser.js", import.meta.url), out);
console.log("wrote lib/data/cnedEser.js", Math.round(out.length / 1024), "kB");
