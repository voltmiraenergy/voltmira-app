"use server";
// lib/draftActions.js — a quote drafted with no signal (lib/offlineDrafts.js)
// becomes a real quote: the company's market and its default price, the
// draft's client, address, size, consumption and battery, and the phone and
// notes in the quote's notes. Returns the real id, which replaces the draft's
// temporary one.
import { supabaseServer } from "./supabase.js";
import { currentCompany, currentActor } from "./session.js";
import { MARKETS } from "@voltmira/engine";
import { logActivity } from "./activity.js";
import { draftPayload } from "./offlineDrafts.js";

export async function createQuoteFromDraft(draft) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const co = await currentCompany();
  if (!user || !co) throw new Error("signed_out");
  const d = draftPayload(draft);
  const market = co.default_market || "MD";
  const notes = [d.phone ? `Tel: ${d.phone}` : "", d.notes].filter(Boolean).join("\n");
  const row = {
    company_id: co.id, owner_id: user.id, market,
    title: d.title || d.client_name || d.address || "Draft",
    client_name: d.client_name, client_email: d.client_email, address: d.address,
    kw: d.kw ?? 5, ...(d.cons ? { cons: d.cons } : {}),
    batt: (d.batt_kwh || 0) > 0, ...(d.batt_kwh ? { batt_kwh: d.batt_kwh } : {}),
    notes,
    price: (MARKETS[market] || MARKETS.MD).defaultPrice,
  };
  let { data, error } = await sb.from("projects").insert(row).select("id").single();
  // a database without one of the newer columns: the essentials, the rest in the title
  if (error) ({ data, error } = await sb.from("projects").insert({ company_id: co.id, owner_id: user.id, market, title: row.title, client_name: row.client_name, address: row.address, kw: row.kw, price: row.price }).select("id").single());
  if (error) throw new Error(error.message);
  await logActivity(sb, { companyId: co.id, kind: "quote", key: "act_quote_created", text: "New quote created from an offline draft", actor: await currentActor(), link: `/projects/${data.id}` });
  return data.id;
}
