// lib/invoiceIssue.js — issuing an invoice: the one place that draws its number.
// It used to happen while the invoice page was rendered, so opening the page (or the PDF route, which renders it
// in a headless browser) drew a number, and two renders at once drew two. Now it is an explicit action: the number
// is drawn from the company's sequence, and written with its date and its figures (lib/invoiceFreeze.js) in one
// statement that only lands while the quote has no number yet; whoever loses the race gets the winner's number.
import { freezeInvoice } from "./invoiceFreeze.js";
import { mdDayKey } from "./tz.js";

/**
 * @param {object} a
 * @param {object} a.sb        the signed-in client (row security scopes the writes to the caller's company)
 * @param {object} a.co        the company row
 * @param {object} a.project   the projects row
 * @param {object} a.inv       projectInvoice() of that project, with the deposit asked for
 * @param {Date}   [a.now]
 * @param {(event:string, payload:object)=>Promise<any>} [a.webhook]  the accounting hook, fired once per new number
 * @returns {Promise<{ok:boolean, invoiceNo?:string, fresh?:boolean, error?:string}>}
 */
export async function issueInvoiceFor({ sb, co, project, inv, now = new Date(), webhook = null }) {
  if (project.invoice_no) return { ok: true, invoiceNo: project.invoice_no, fresh: false };
  const { data: seq } = await sb.rpc("next_invoice_no", { p_company: co.id });
  if (!seq) return { ok: false, error: "no_sequence" };
  const prefix = String(co.invoice_prefix || "PF").slice(0, 6);
  // the year is the Chișinău one: just after midnight on 1 January the server (UTC) is still in the old year
  const year = mdDayKey(now).slice(0, 4);
  const candidate = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
  const frozen = freezeInvoice({ amounts: inv.amounts, cur: inv.cur, fx: inv.fx, fxInfo: inv.fxInfo, project });

  // Written only while there is no number yet. A database not yet given the newer columns still takes the number:
  // without the figures (then they are worked out from the quote as before), without the date.
  const write = (cols) => sb.from("projects").update(cols).eq("id", project.id).is("invoice_no", null).select("invoice_no");
  const full = { invoice_no: candidate, invoiced_at: now.toISOString(), invoice_amounts: frozen };
  let { data: rows, error } = await write(full);
  if (error && /invoice_amounts/i.test(error.message || "")) {
    const rest = { ...full };
    delete rest.invoice_amounts;
    ({ data: rows, error } = await write(rest));
  }
  if (error && /invoiced_at/i.test(error.message || "")) ({ data: rows, error } = await write({ invoice_no: candidate }));
  if (error) return { ok: false, error: "save_failed" };

  if (!rows?.length) {
    // someone issued it between the read and the write: theirs stands
    const { data: cur } = await sb.from("projects").select("invoice_no").eq("id", project.id).maybeSingle();
    return cur?.invoice_no ? { ok: true, invoiceNo: cur.invoice_no, fresh: false } : { ok: false, error: "save_failed" };
  }
  // The accounting hook fires exactly once, for the new number: net/vat/gross are the printed amounts, in `currency`.
  // (The honest path to 1C and other accounting software: a generic webhook, lib/crmWebhook.js.)
  if (webhook) {
    try {
      await webhook("invoice.created", {
        project_id: project.id, invoice_no: candidate, client_name: project.client_name || project.title,
        net: inv.amounts.net, vat: inv.amounts.vat, gross: inv.amounts.gross, currency: inv.cur,
        deposit_pct: inv.amounts.depositPct || undefined,
      });
    } catch { /* the number is issued; a hook that fails never undoes it */ }
  }
  return { ok: true, invoiceNo: candidate, fresh: true };
}
