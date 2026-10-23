// lib/invoiceServer.js — a quote's invoice figures, recomputed on the server
// from the project and the workspace, the same way the proforma page prints
// them (app/(app)/projects/[id]/invoice/page.jsx): the engine's price, the
// live rate, invoiceAmounts. e-Factura and the billing page use these, never
// a number from the browser. Also the guard every billing route shares.
import { NextResponse } from "next/server";
import { quote } from "@voltmira/engine";
import { companyEngine } from "./engineSettings.js";
import { getRate } from "./fx.js";
import { rowToQuoteInput } from "./quoteInput.js";
import { invoiceAmounts } from "./invoiceMath.js";
import { readFrozen } from "./invoiceFreeze.js";
import { effectiveOfferCurrency } from "./offerCurrency.js";
import { t, normLang } from "./i18n.js";
import { supabaseServer } from "./supabase.js";
import { currentUser, currentCompany } from "./session.js";
import { projectVisibility } from "./projectAccess.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * An issued invoice reads the figures written with its number (lib/invoiceFreeze.js), so every reader prints the
 * same amount on any day; before that, or on an invoice issued before that existed, they are worked out from the
 * quote, today's rate and the workspace's settings.
 * @param {{depositPct?: number}} [opt]  a deposit to split off, for a draft not yet issued
 * @returns {Promise<{ cur, fx, fxInfo, amounts, grossMinor, description, line, kind, frozen }>}
 */
export async function projectInvoice(p, co, { depositPct = 0 } = {}) {
  const lang = normLang(co.lang);
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO";
  const kind = ["sme", "company"].includes(p.client_kind) ? "company" : "person";
  const fz = p.invoice_no ? readFrozen(p.invoice_amounts) : null;
  if (fz) {
    const kw = fz.kw.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return {
      cur: fz.cur, fx: fz.fx, fxInfo: fz.fxInfo, amounts: fz.amounts, grossMinor: fz.amounts.gross * 100,
      description: `${fz.title ? fz.title + ", " : ""}${t("inv_line", lang, { kw })}`,
      line: { title: fz.title, kw: fz.kw, battKwh: fz.battKwh }, kind, frozen: true,
    };
  }
  const cur = effectiveOfferCurrency(p.offer_currency, co.currency, p.market);
  const fxInfo = await getRate(cur);
  const fx = Number(fxInfo.rate) > 0 ? Number(fxInfo.rate) : 1;
  const E = await companyEngine(co);
  const q = quote(rowToQuoteInput(p, E), E).e;
  const amounts = invoiceAmounts({ grossEur: q.cost, fx, vatRatePct: co.vat_rate, depositPct });
  const kw = Number(p.kw || 0).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    cur, fx, fxInfo, amounts, grossMinor: amounts.gross * 100,
    description: `${p.title ? p.title + ", " : ""}${t("inv_line", lang, { kw })}`,
    line: { title: p.title || "", kw: Number(p.kw) || 0, battKwh: p.batt ? Number(p.batt_kwh) || 10 : null }, kind, frozen: false,
  };
}

/** Signed in, and the project is the caller's (RLS read). Returns { user, co, project } or a Response. */
export async function billingGuard(id) {
  if (!UUID_RE.test(String(id || ""))) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });
  const { data: project } = await (await supabaseServer()).from("projects").select("*").eq("id", id).maybeSingle();
  if (!project || project.company_id !== co.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // access control: a Sales member sees only the quotes they own
  if (!(await projectVisibility(user, co))(project)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return { user, co, project };
}
