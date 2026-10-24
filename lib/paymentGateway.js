// lib/paymentGateway.js — the card payment for a fee per won project, behind one shape so the bank can change
// without the fee code changing. Server only.
//
//   start({ orderId, amountMinor, currency, description, returnUrl }) -> { ok, paidNow?, redirect?, form?, error? }
//   verify(req)  -> { ok, orderId, amountMinor, approved, reply } | { ok: false, error }   (the bank's callback)
//
// mock          local and demo: the payment succeeds at once and is labelled as a test everywhere. Never in
//               production unless JOB_FEES_MOCK=on is set on purpose (a staging site).
// victoriabank  a stub until the merchant documentation and keys arrive. The env names below are placeholders to
//               confirm against Victoria Bank's e-commerce gateway documentation; nothing about its protocol (field
//               names, the signature scheme, the callback) is guessed here. Until then it answers "not_configured",
//               and the installer is offered the bank transfer instead.

export function mockGateway() {
  return {
    id: "mock",
    test: true,
    async start() { return { ok: true, paidNow: true }; },
    async verify() { return { ok: false, error: "not_used" }; },
  };
}

export function victoriaBankGateway(env = process.env) {
  const ready = !!(env.VB_MERCHANT_ID && env.VB_TERMINAL_ID && env.VB_KEY);
  return {
    id: "victoriabank",
    test: false,
    ready,
    // To build once the documentation is in hand: the signed request the bank expects (most Moldovan acquirers take
    // an HTML form POSTed to their page, signed with the merchant key), and the verification of its callback.
    async start() { return { ok: false, error: "not_configured" }; },
    async verify() { return { ok: false, error: "not_configured" }; },
  };
}

/** The gateway in use: the bank once its keys are set, the test one off production, else none. */
export function gatewayFor(env = process.env) {
  const vb = victoriaBankGateway(env);
  if (vb.ready) return vb;
  if (env.NODE_ENV !== "production" || String(env.JOB_FEES_MOCK || "").toLowerCase() === "on") return mockGateway();
  return vb;   // answers not_configured
}

/** An order id for the bank: short, unique, no personal data. "VMF" + time + random. */
export function newOrderId(now = Date.now(), rand = Math.random) {
  return `VMF${now.toString(36).toUpperCase()}${Math.floor(rand() * 36 ** 4).toString(36).toUpperCase().padStart(4, "0")}`;
}
