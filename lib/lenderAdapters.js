// lib/lenderAdapters.js — how a loan application reaches its lender
// (docs/FINANCING.md). Every lender is reached through one interface:
//
//   adapter.submit(application, { lender, document }) ->
//     { ok: true, ref, channel }                      the lender has it
//     { ok: false, error, retryable }                 it did not get there
//
// Two adapters exist:
//   mock   accepts every application at once with a MOCK- reference; the
//          sample lenders use it, so the whole flow works with no partner.
//   email  sends the application to the lender's contact address, with the
//          application as a PDF: the fallback for a lender with no API.
// A real lender API is a third adapter with the same submit(); its keys come
// from environment variables, never from the code. The I/O (sending an
// email, drawing a PDF) is passed in, so each adapter is tested without it.

/** @param {{ fail?: string }} [o] a forced failure, for tests */
export function mockAdapter(o = {}) {
  return {
    id: "mock",
    async submit(app) {
      if (o.fail) return { ok: false, error: o.fail, retryable: true };
      return { ok: true, ref: `MOCK-${String(app.id).replace(/-/g, "").slice(0, 10).toUpperCase()}`, channel: "mock" };
    },
  };
}

/**
 * @param {object} io
 * @param {(m: object) => Promise<{sent?: boolean, error?: string, skipped?: boolean}>} io.sendEmail
 * @param {() => boolean} io.emailConfigured
 * @param {(html: string) => Promise<Uint8Array|Buffer>} io.buildPdf
 */
export function emailAdapter({ sendEmail, emailConfigured, buildPdf }) {
  return {
    id: "email",
    async submit(app, { lender, document }) {
      if (!lender?.contact_email) return { ok: false, error: "no_contact_email", retryable: false };
      if (!emailConfigured()) return { ok: false, error: "email_not_configured", retryable: false };
      let pdf;
      try { pdf = await buildPdf(document.html); } catch { return { ok: false, error: "pdf_failed", retryable: true }; }
      const r = await sendEmail({
        to: lender.contact_email, subject: document.subject, html: document.html,
        attachments: [{ filename: document.filename, content: Buffer.from(pdf).toString("base64") }],
      });
      if (!r?.sent) return { ok: false, error: r?.error || "email_not_sent", retryable: true };
      return { ok: true, ref: `EMAIL-${String(app.id).replace(/-/g, "").slice(0, 10).toUpperCase()}`, channel: "email" };
    },
  };
}

/** The adapter a lender is reached with. */
export function adapterFor(lender, io) {
  return lender?.adapter === "email" ? emailAdapter(io) : mockAdapter();
}
