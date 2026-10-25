// lib/payAdapters.js — card payment on the client's pay page, through the installer's own bank: a placeholder for
// later. Each Moldovan bank's e-commerce gateway (MAIB, Paynet, Victoria Bank) needs the installer's merchant account
// and the bank's integration documentation; none is wired yet and nothing here calls a bank. Until an adapter is
// built against real documentation, `ready` is false and the pay page offers bank transfer only.

export const CARD_ADAPTERS = [
  { id: "maib", name: "MAIB" },
  { id: "paynet", name: "Paynet" },
  { id: "victoriabank", name: "Victoria Bank" },
];

/** The card gateways ready for a workspace: none until one is built (docs/features/phase4.md, "Not done here"). */
export function readyCardAdapters() {
  return [];
}
