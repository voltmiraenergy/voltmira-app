"use server";
// lib/studioLink.js — one client, one place: a Studio job and the quote it
// belongs to. The job keeps the quote's id (job.projectId, in the workspace's
// Studio copy, studio_state); the quote finds its job from there. A link, not
// a copy: neither side overwrites the other, and the job page says when the
// two system sizes differ. Session client throughout, so row security keeps
// it inside the caller's company.
import { supabaseServer } from "./supabase.js";
import { currentCompany, currentActor } from "./session.js";
import { MARKETS } from "@voltmira/engine";
import { logActivity } from "./activity.js";

import { JOBS_KEY } from "./studioKeys.js";

/** The company's quotes to link a job to, newest first. */
export async function quotesForLink() {
  const sb = await supabaseServer();
  const { data } = await sb.from("projects").select("id, title, client_name, kw, status, updated_at").order("updated_at", { ascending: false }).limit(60);
  return (data || []).map((p) => ({ id: p.id, title: p.title || "", client: p.client_name || "", kw: Number(p.kw) || 0, status: p.status }));
}

/** One quote's headline, for a linked job's card; null when it is gone. */
export async function quoteSummary(projectId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(projectId || ""))) return null;
  const sb = await supabaseServer();
  const { data: p } = await sb.from("projects").select("id, title, client_name, kw, status").eq("id", projectId).maybeSingle();
  return p ? { id: p.id, title: p.title || "", client: p.client_name || "", kw: Number(p.kw) || 0, status: p.status } : null;
}

/** A new quote from a Studio job: its client, address, size, consumption and battery. @returns {Promise<string>} the quote's id */
export async function createQuoteFromJob(job) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const co = await currentCompany();
  if (!user || !co) throw new Error("signed_out");
  const market = ["MD", "UA"].includes(job?.market) ? job.market : (co.default_market || "MD");
  const clip = (v, n) => String(v ?? "").trim().slice(0, n);
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const row = {
    company_id: co.id, owner_id: user.id, market,
    title: clip(job?.name, 120) || clip(job?.address, 120) || "Studio",
    client_name: clip(job?.name, 120) || null,
    address: clip(job?.address, 300) || null,
    kw: num(job?.kw) ?? 5,
    cons: num(job?.cons),
    batt: (num(job?.batteryKwh) || 0) > 0,
    batt_kwh: num(job?.batteryKwh),
    lat: Number.isFinite(Number(job?.lat)) ? Number(job.lat) : null,
    lon: Number.isFinite(Number(job?.lng)) ? Number(job.lng) : null,
    // the market's own price, in its own currency: a Studio job keeps EUR
    price: (MARKETS[market] || MARKETS.MD).defaultPrice,
  };
  let { data, error } = await sb.from("projects").insert(row).select("id").single();
  // a database without one of the newer columns: the essentials only
  if (error) ({ data, error } = await sb.from("projects").insert({ company_id: co.id, owner_id: user.id, market, title: row.title, client_name: row.client_name, address: row.address, kw: row.kw, price: row.price }).select("id").single());
  if (error) throw new Error(error.message);
  await logActivity(sb, { companyId: co.id, kind: "quote", key: "act_quote_created", text: "New quote created from a Studio job", actor: await currentActor(), link: `/projects/${data.id}` });
  return data.id;
}

/** The Studio job linked to a quote, if any: { id, name, kw } or null. */
export async function studioJobFor(projectId) {
  const sb = await supabaseServer();
  const { data } = await sb.from("studio_state").select("value").eq("key", JOBS_KEY).maybeSingle();
  const job = (Array.isArray(data?.value) ? data.value : []).find((j) => j && j.projectId === projectId);
  return job ? { id: String(job.id), name: String(job.name || ""), kw: Number(job.kw) || 0 } : null;
}
