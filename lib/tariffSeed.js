// lib/tariffSeed.js — version 1 of the tariff rules, in code: exactly what the
// app used before rules were versioned, and what it uses until
// supabase/add-tariffs-subsidies.sql has run. The SQL file seeds the same rows
// (lib/tariffSeed.test.js checks they agree). Rows have the table's shape.
import { latestSeasonalMdl } from "./prosumerPrice.js";
import { toMinorPerMwh } from "./tariffRules.js";

const EXPORT_V1 = latestSeasonalMdl().map((v) => (v == null ? null : toMinorPerMwh(v)));

export const TARIFF_SEED = [
  {
    id: "seed-md-premier-1", market: "MD", operator: "premier", version: 1,
    effective_from: "2024-01-01", effective_to: null, currency: "MDL",
    retail_flat_minor_per_mwh: null, retail_day_minor_per_mwh: 375000, retail_night_minor_per_mwh: 294000,
    export_monthly: EXPORT_V1, export_flat_minor_per_mwh: null, prosumer_max_kw: null,
    source_title: "Premier Energy Distribution: prețul mediu lunar de procurare a energiei livrate de prosumatori",
    source_url: "", note: "Latest published month for each calendar month (2026 Jan to Jul, 2025 Aug to Dec). Day/night retail: the defaults the app used.",
    created_by: "seed",
  },
  {
    id: "seed-md-rednord-1", market: "MD", operator: "rednord", version: 1,
    effective_from: "2024-01-01", effective_to: null, currency: "MDL",
    retail_flat_minor_per_mwh: null, retail_day_minor_per_mwh: 489000, retail_night_minor_per_mwh: 391000,
    export_monthly: EXPORT_V1, export_flat_minor_per_mwh: null, prosumer_max_kw: null,
    source_title: "Premier Energy Distribution buy-back table, applied to RED Nord until RED Nord's own is sourced",
    source_url: "", note: "RED Nord's buy-back table is not in VoltMira yet: the app priced its exports with Premier's, and this version records that. Day/night retail: FEE-Nord rates from Settings.",
    created_by: "seed",
  },
];
