// lib/qsignServer.js — what the qualified signature signs, read from the
// frozen offer (docs/INTEGRATIONS.md). Server only.
import { quote } from "@voltmira/engine";
import { snapshotEngine } from "./engineSettings.js";
import { offerQuoteInput } from "./offerInput.js";
import { effectiveOfferCurrency } from "./offerCurrency.js";
import { documentHashFor } from "./qsign.js";

/**
 * The hash of the offer as the client reads it: its code, title, client, size,
 * price at the frozen engine settings, currency and the day it was sent.
 * @returns {Promise<{ hash: string, title: string } | null>}
 */
export async function offerDocument(db, code) {
  const { data: prop } = await db.from("proposals").select("code, company_id, snapshot, created_at").eq("code", code).maybeSingle();
  if (!prop?.snapshot) return null;
  const { data: co } = await db.from("companies").select("engine, currency").eq("id", prop.company_id).maybeSingle();
  const snap = prop.snapshot;
  const E = snapshotEngine(snap.engine, co);
  const cost = quote(offerQuoteInput(snap), E).e.cost;
  const currency = effectiveOfferCurrency(snap.offerCurrency, co?.currency, snap.market);
  return {
    title: String(snap.title || code),
    hash: documentHashFor({ code, title: snap.title || "", client: snap.client || "", kw: snap.kw, costEur: cost, currency, sentAt: String(prop.created_at || "").slice(0, 10) }),
  };
}
