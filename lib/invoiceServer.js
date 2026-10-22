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
import { effectiveOfferCurrency } from "./offerCurrency.js";
import { t, normLang } from "./i18n.js";
import { supabaseServer } from "./supabase.js";
import { currentUser, currentCompany } from "./session.js";
import { projectVisibility } from "./projectAccess.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** @returns {Promise<{ cur, fx, amounts, grossMinor, description, kind }>} */
export async function projectInvoice(p, co) {
  const lang = normLang(co.lang);
  const cur = effectiveOfferCurrency(p.offer_currency, co.currency, p.market);
  const fxInfo = await getRate(cur);
  const fx = Number(fxInfo.rate) > 0 ? Number(fxInfo.rate) : 1;
  const E = await companyEngine(co);
  const q = quote(rowToQuoteInput(p, E), E).e;
  const amounts = invoiceAmounts({ grossEur: q.cost, fx, vatRatePct: co.vat_rate });
  const kw = Number(p.kw || 0).toLocaleString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    cur, fx, amounts, grossMinor: amounts.gross * 100,
    description: `${p.title ? p.title + ", " : ""}${t("inv_line", lang, { kw })}`,
    kind: ["sme", "company"].includes(p.client_kind) ? "company" : "person",
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
