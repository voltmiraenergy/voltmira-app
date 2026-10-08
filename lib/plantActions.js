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
import { getSolarYield, getYearlyIrradiation } from "@voltmira/engine/pvgis";
import { fetchWindScreening } from "./windData.js";
import { fetchGridNear, fetchCrossings } from "./gridData.js";
import { samplePortfolio, blankPlant } from "./plantSample.js";
import { PLANTS_KEY } from "./portfolioModel.js";
import { solarSiteData } from "./solarSite.js";


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
export async function solarYieldAt(lat, lon) {
  const { user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  if (await isRateLimited(`pvgis:${user.id}`, 20, 60_000)) return { ok: false, error: "rate_limited" };
  try {
    const r = await getSolarYield(Number(lat), Number(lon), { loss: 14, timeoutMs: 15000 });
    // each year on record, for the weather replay; the yield stands without it
    const w = await getYearlyIrradiation(Number(lat), Number(lon), { timeoutMs: 15000 }).catch(() => null);
    return { ok: true, yieldKwhKwp: Math.round(r.yieldPerKwp), site: solarSiteData(r, w) };
  } catch {
    return { ok: false, error: "pvgis_unavailable" };
  }
}

/** Fill a sample's sites with their real wind and sun, where the public services answer. */
async function withSiteData(plants) {
  const out = [];
  for (const p of plants) {
    const q = { ...p };
    if (q.solar && !(q.solar.yieldKwhKwp > 0) && q.lat != null) {
      try {
        const r = await getSolarYield(q.lat, q.lon, { loss: 14, timeoutMs: 15000 });
        const w = await getYearlyIrradiation(q.lat, q.lon, { timeoutMs: 15000 }).catch(() => null);
        q.solar = { ...q.solar, yieldKwhKwp: Math.round(r.yieldPerKwp), yieldSource: "pvgis", yieldAt: { lat: q.lat, lon: q.lon }, ...solarSiteData(r, w) };
      } catch { /* left at 0: the page offers the lookup */ }
    }
    if (q.wind && !q.wind.screening && q.lat != null) {
      try { q.wind = { ...q.wind, screening: await fetchWindScreening(q.lat, q.lon) }; } catch { /* the page offers it */ }
    }
    // the grid around a utility-scale sample (5 MW and up): one query each
    const mw = (q.wind ? Number(q.wind.mw) || 0 : 0) + (q.solar ? Number(q.solar.mwp) || 0 : 0);
    if (!q.grid && q.lat != null && mw >= 5) {
      try { q.grid = (await fetchGridNear(q.lat, q.lon)).grid; } catch { /* the page offers it */ }
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
  const plants = await withSiteData(s.plants);
  const { data, error } = await sb.from("portfolios").insert({ name: s.name, market: "MD", assets: { [PLANTS_KEY]: plants }, finance: s.finance }).select("id").single();
  if (error || !data) redirect("/portfolios?err=failed");
  revalidatePath("/portfolios");
  redirect(`/portfolios/${data.id}#plants`);
}

/** Form action: a new utility project, a portfolio with one empty plant to fill in. */
export async function createPlantProject(formData) {
  const { sb, user } = await signedIn();
  if (!user) redirect("/login");
  const name = String(formData.get("name") || "").trim().slice(0, 160) || "Plant";
  const { data, error } = await sb.from("portfolios").insert({ name, market: "MD", assets: { [PLANTS_KEY]: [blankPlant(name)] } }).select("id").single();
  if (error || !data) redirect("/portfolios?err=failed");
  revalidatePath("/portfolios");
  redirect(`/portfolios/${data.id}#plants`);
}
