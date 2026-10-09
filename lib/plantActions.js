"use server";
// lib/plantActions.js — the server side of utility plants in portfolios:
// public wind and sun data for a site (screening), the power grid around it
// (OpenStreetMap), the sample projects, and a new plant project. Everything runs on the caller's own Supabase session, so
// row-level security keeps each portfolio inside its company. Public data
// calls are rate-limited per user.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase.js";
import { currentCompany } from "./session.js";
import { normLang } from "./i18n.js";
import { isRateLimited } from "./ratelimit.js";
import { getSolarYield, getYearlyIrradiation, getClippingCurve } from "@voltmira/engine/pvgis";
import { fetchWindScreening } from "./windData.js";
import { fetchGridNear, fetchCrossings } from "./gridData.js";
import { samplePortfolio, SAMPLE_GRID_COSTS } from "./plantSample.js";
import { normalizePlant } from "./plantFinance.js";
import { compareOptions } from "./gridOptions.js";
import { autoPlot } from "./plantLayout.js";
import { defaultEngineSettings } from "@voltmira/engine";
import { PLANTS_KEY } from "./portfolioModel.js";
import { getSiteClimate } from "@voltmira/engine/siteClimate";
import { solarSiteData } from "./solarSite.js";
import { mdDayKey } from "./tz.js";
import { parsePlantStart } from "./plantStart.js";


async function signedIn() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

/** Wind at a site from public data (lib/windData.js), for the screening estimate. */
export async function screenWindAt(lat, lon) {
  const { user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  if (await isRateLimited(`wind:${user.id}`, 10, 60_000)) return { ok: false, error: "rate_limited" };
  try {
    return { ok: true, screening: await fetchWindScreening(Number(lat), Number(lon)) };
  } catch (e) {
    return { ok: false, error: String(e?.message || "wind_data_unavailable") };
  }
}

/**
 * The power grid around a site (lib/gridData.js): Moldova's substations at
 * 35 kV and above and the high-voltage lines, with their distances. Returns
 * the record kept on the plant and the lines' routes for the map.
 */
export async function gridNearAt(lat, lon) {
  const { user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return { ok: false, error: "bad_point" };
  if (await isRateLimited(`grid:${user.id}`, 10, 60_000)) return { ok: false, error: "rate_limited" };
  try {
    return { ok: true, ...(await fetchGridNear(la, lo)) };
  } catch {
    return { ok: false, error: "grid_unavailable" };
  }
}

/** What a connection route crosses (lib/gridCrossings.js): a route of [lat, lon] points, 2 to 200 of them. */
export async function routeCrossingsAt(points) {
  const { user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  const pts = (Array.isArray(points) ? points : []).slice(0, 200)
    .map((q) => (Array.isArray(q) ? [Number(q[0]), Number(q[1])] : null))
    .filter((q) => q && Number.isFinite(q[0]) && Number.isFinite(q[1]) && Math.abs(q[0]) <= 90 && Math.abs(q[1]) <= 180);
  if (pts.length < 2) return { ok: false, error: "bad_route" };
  if (await isRateLimited(`grid:${user.id}`, 10, 60_000)) return { ok: false, error: "rate_limited" };
  try {
    return { ok: true, crossings: await fetchCrossings(pts) };
  } catch {
    return { ok: false, error: "grid_unavailable" };
  }
}

/** A site's solar yield, kWh per kWp a year, from PVGIS (14% system losses, 35 degrees, south). */
export async function solarYieldAt(lat, lon, design = null) {
  const { user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  if (await isRateLimited(`pvgis:${user.id}`, 20, 60_000)) return { ok: false, error: "rate_limited" };
  // the design's fixed tilt and azimuth, where entered (0 is south, -90 east, 90 west); else 35 degrees south
  const tilt = Number.isFinite(Number(design?.tilt)) ? Math.min(90, Math.max(0, Number(design.tilt))) : 35;
  const azimuth = Number.isFinite(Number(design?.azimuth)) ? Math.min(180, Math.max(-180, Number(design.azimuth))) : 0;
  try {
    const r = await getSolarYield(Number(lat), Number(lon), { loss: 14, angle: tilt, aspect: azimuth, timeoutMs: 15000 });
    // each year on record, for the weather replay; the yield stands without it
    const [w, clip] = await Promise.all([
      getYearlyIrradiation(Number(lat), Number(lon), { angle: tilt, aspect: azimuth, timeoutMs: 15000 }).catch(() => null),
      getClippingCurve(Number(lat), Number(lon), { angle: tilt, aspect: azimuth, timeoutMs: 20000 }).catch(() => null),
    ]);
    return { ok: true, yieldKwhKwp: Math.round(r.yieldPerKwp), site: solarSiteData(r, w, clip, { tilt, azimuth }) };
  } catch {
    return { ok: false, error: "pvgis_unavailable" };
  }
}

/** A site's elevation, horizon and twenty-year weather extremes (temperature, strongest wind, snow), from public data (engine/siteClimate.js). Screening values, not design values. */
export async function siteClimateAt(lat, lon) {
  const { user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  if (await isRateLimited(`climate:${user.id}`, 10, 60_000)) return { ok: false, error: "rate_limited" };
  try {
    const c = await getSiteClimate(Number(lat), Number(lon), { timeoutMs: 25000 });
    return { ok: true, climate: { ...c, at: { lat: Number(lat), lon: Number(lon) }, fetched: mdDayKey(new Date()) } };
  } catch {
    return { ok: false, error: "climate_unavailable" };
  }
}

/**
 * Fill a sample's sites with their real wind and sun, where the public
 * services answer, and complete the picture: the best grid connection
 * applied (at illustrative costs, the same kind of figure as every other
 * cost in the sample, lib/plantSample.js SAMPLE_GRID_COSTS) and a drawn site
 * plan, sized for the solar tables and, for a hybrid, the wind turbines too.
 * @param {object[]} plants  @param {object|null} [finance]  the portfolio's finance terms, to weigh the grid options
 * @param {{ sample?: boolean }} [opts]  a real plant gets the public data only: no
 *   illustrative grid costs, no drawn plot (its plot is drawn by hand)
 */
async function withSiteData(plants, finance = null, { sample = true } = {}) {
  const out = [];
  for (const p of plants) {
    const q = { ...p };
    if (q.solar && !(q.solar.yieldKwhKwp > 0) && q.lat != null) {
      try {
        const r = await getSolarYield(q.lat, q.lon, { loss: 14, timeoutMs: 15000 });
        const [w, clip] = await Promise.all([
          getYearlyIrradiation(q.lat, q.lon, { timeoutMs: 15000 }).catch(() => null),
          getClippingCurve(q.lat, q.lon, { timeoutMs: 20000 }).catch(() => null),
        ]);
        q.solar = { ...q.solar, yieldKwhKwp: Math.round(r.yieldPerKwp), yieldSource: "pvgis", yieldAt: { lat: q.lat, lon: q.lon }, ...solarSiteData(r, w, clip) };
      } catch { /* left at 0: the page offers the lookup */ }
    }
    if (q.lat != null && !q.climate) {
      try { q.climate = { ...(await getSiteClimate(q.lat, q.lon, { timeoutMs: 25000 })), at: { lat: q.lat, lon: q.lon }, fetched: mdDayKey(new Date()) }; } catch { /* the page offers it */ }
    }
    if (q.wind && !q.wind.screening && q.lat != null) {
      try { q.wind = { ...q.wind, screening: await fetchWindScreening(q.lat, q.lon) }; } catch { /* the page offers it */ }
    }
    // the grid around a utility-scale sample (5 MW and up): one query each
    const mw = (q.wind ? Number(q.wind.mw) || 0 : 0) + (q.solar ? Number(q.solar.mwp) || 0 : 0);
    if (!q.grid && q.lat != null && mw >= 5) {
      try {
        q.grid = (await fetchGridNear(q.lat, q.lon)).grid;
        // the best connection, applied, at illustrative costs, so the sample does not sit half-finished
        if (q.grid && finance && sample) {
          q.grid = { ...q.grid, costs: SAMPLE_GRID_COSTS };
          const cmp = compareOptions(q, { E: defaultEngineSettings(), fin: finance, scenario: {} });
          const best = cmp.recommended ? cmp.options.find((o) => o.key === cmp.recommended) : null;
          if (best) {
            q.costs = { ...(q.costs || {}), gridEur: Math.round(best.costEur) };
            q.grid = {
              ...q.grid, choice: { kind: best.kind, id: best.id, cls: best.cls },
              applied: { key: best.key, costEur: Math.round(best.costEur), lossPct: Math.round(best.loss.pct * 1000) / 1000, on: mdDayKey(new Date()) },
            };
          }
        }
      } catch { /* the page offers it */ }
    }
    // a complete site plan: a plot sized for the solar tables and the wind turbines, oriented
    // by whichever side the grid connection just chosen leaves from
    if (sample && !q.layout && q.lat != null && q.solar) {
      try { const auto = autoPlot(normalizePlant(q)); if (auto) q.layout = auto; } catch { /* the page offers the planner */ }
    }
    out.push(q);
  }
  return out;
}

/** Form action: load a sample project ("hybrid" or "rooftops") as a new portfolio, and open it. */
export async function createSampleProject(formData) {
  const { sb, user } = await signedIn();
  if (!user) redirect("/login");
  if (await isRateLimited(`sample:${user.id}`, 6, 60_000)) redirect("/portfolios?err=rate_limited");
  const co = await currentCompany();
  const kind = formData.get("kind") === "rooftops" ? "rooftops" : "hybrid";
  const s = samplePortfolio(kind, normLang(co?.lang));
  const plants = await withSiteData(s.plants, s.finance);
  const { data, error } = await sb.from("portfolios").insert({ name: s.name, market: "MD", assets: { [PLANTS_KEY]: plants }, finance: s.finance }).select("id").single();
  if (error || !data) redirect("/portfolios?err=failed");
  revalidatePath("/portfolios");
  redirect(`/portfolios/${data.id}#plants`);
}


/**
 * Form action (useActionState): a developer's own plant from the guided
 * start (app/(app)/portfolios/start), with the site's public data looked up:
 * the sun from PVGIS, the wind screening, the grid around it, the site's
 * climate. Every cost, price and loan term is the developer's; a field left
 * empty is asked for again, never filled in.
 * @returns {Promise<{ errors: string[], values: Record<string,string> }>}  only when something is missing
 */
export async function startPlantProject(_prev, formData) {
  const { sb, user } = await signedIn();
  if (!user) redirect("/login");
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const { plant, finance, errors } = parsePlantStart(values);
  if (errors.length) return { errors, values };
  if (await isRateLimited(`start:${user.id}`, 6, 60_000)) return { errors: ["err_rate_limited"], values };
  const [ready] = await withSiteData([plant], finance, { sample: false });
  const { data, error } = await sb.from("portfolios").insert({ name: plant.name, market: "MD", assets: { [PLANTS_KEY]: [ready] }, finance }).select("id").single();
  if (error || !data) return { errors: ["err_failed"], values };
  revalidatePath("/portfolios");
  redirect(`/portfolios/${data.id}#plants`);
}
