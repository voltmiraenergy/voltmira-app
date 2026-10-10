// lib/paperwork.js — where each quote's documents stand.
//
// Every state here is read from something the app already records: the
// proposal row (sent, accepted, who signed), the invoice number drawn on the
// proforma, the install checklist (permit, grid connection, commissioning) and
// commissioned_at. Nothing is ticked by hand on this screen, so it can't drift
// from the quote itself.
//
// Pure: no I/O, no language. The Documents page and the dashboard's paperwork
// card both read from here, so they always agree.

/** The documents a job can have, in the order they are usually produced. */
export const DOCS = ["proposal", "signed", "contract", "invoice", "permit", "grid", "commissioning", "diagram"];

/** What a won job still needs, in the order it is usually done. */
export const REQUIRED = ["signed", "invoice", "permit", "grid", "commissioning"];

/**
 * @param {object} p     a `projects` row
 * @param {object|null} prop  its proposal: { code, created_at, accepted_at, signer_name }
 * @returns {{ docs: Record<string, {state: "done"|"todo"|"waiting", at?: string, by?: string, no?: string, code?: string}>, missing: string[] }}
 */
export function paperworkFor(p, prop = null) {
  const prog = (p && p.install_progress) || {};
  const commissionedAt = prog.commission || p.commissioned_at || null;
  const docs = {
    proposal: prop ? { state: "done", at: prop.created_at || null, code: prop.code } : { state: "todo" },
    // Sent but not accepted yet is "waiting" on the client, not on you.
    signed: prop && prop.accepted_at
      ? { state: "done", at: prop.accepted_at, by: prop.signer_name || "" }
      : { state: prop ? "waiting" : "todo" },
    // The service contract template is always available to print.
    contract: { state: "todo" },
    invoice: p.invoice_no ? { state: "done", at: p.invoiced_at || null, no: p.invoice_no } : { state: "todo" },
    permit: prog.permit ? { state: "done", at: prog.permit } : { state: "todo" },
    grid: prog.grid ? { state: "done", at: prog.grid } : { state: "todo" },
    commissioning: commissionedAt ? { state: "done", at: commissionedAt } : { state: "todo" },
    diagram: { state: "todo" },
  };
  const missing = p.status === "won" ? REQUIRED.filter((k) => docs[k].state !== "done") : [];
  return { docs, missing };
}

/** Headline counts across a set of projects (for the page header and strip). */
export function paperworkTotals(projects, proposalsByProject) {
  let won = 0, signed = 0, invoiced = 0, connected = 0, commissioned = 0, toFinish = 0;
  for (const p of projects) {
    const { docs, missing } = paperworkFor(p, proposalsByProject.get(p.id) || null);
    if (docs.signed.state === "done") signed++;
    if (docs.invoice.state === "done") invoiced++;
    if (p.status !== "won") continue;
    won++;
    if (docs.grid.state === "done") connected++;
    if (docs.commissioning.state === "done") commissioned++;
    if (missing.length) toFinish++;
  }
  return { won, signed, invoiced, connected, commissioned, toFinish };
}
