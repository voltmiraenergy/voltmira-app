// lib/quoteOptions.js — a quote made from a lead's estimate: the recommended system as the quote itself, and two
// alternatives beside it on the offer (projects.options, shown side by side): a smaller "essential" one and a
// "complete" one with a battery. The equipment comes from the installer's own catalog when it has a panel and an
// inverter, else the built-in starter kit (lib/supplierCatalog.js autoBom). Pure, no I/O.
import { autoBom } from "./supplierCatalog.js";

const num = (s, unit) => {
  const m = String(s || "").replace(",", ".").match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "i"));
  return m ? Number(m[1]) : NaN;
};
const r1 = (n) => Math.round(n * 10) / 10;
// half a kW, as installers quote: 4.5, 6, 7.5
const half = (n) => Math.round(n * 2) / 2;

/** The battery a "complete" option carries: about 60% of a day's use, 5 to 15 kWh, in whole kWh. */
export function batteryFor(consKwhYear) {
  const day = Math.max(0, Number(consKwhYear) || 0) / 365;
  return Math.min(15, Math.max(5, Math.round(day * 0.6)));
}

/**
 * The two alternatives beside the recommended quote.
 * @param {number} kw  the recommended size
 * @param {number} consKwhYear
 * @param {{essential: string, complete: string}} labels  in the workspace's language
 * @returns {{label: string, kw: number, battKwh: number}[]}
 */
export function alternatives(kw, consKwhYear, labels) {
  const k = Math.max(1, Number(kw) || 0);
  const small = Math.max(1, half(k * 0.7));
  const out = [];
  if (small < k) out.push({ label: String(labels?.essential || "").slice(0, 40), kw: small, battKwh: 0 });
  out.push({ label: String(labels?.complete || "").slice(0, 40), kw: r1(k), battKwh: batteryFor(consKwhYear) });
  return out;
}

// the installer's own products as bill-of-materials lines, the way the editor adds them (components/BomCard.jsx)
function line(p, qty) {
  return {
    kind: p.kind, brand: p.brand || "", model: p.model || "", spec: p.spec || "", qty,
    unit_price: Number(p.cost_price) > 0 ? Number(p.cost_price) : Number(p.unit_price) || 0,
    source: "own", productId: p.id,
  };
}

/**
 * Equipment for a size from the installer's catalog: the panel with the most watts, the smallest inverter that
 * covers the size (else the largest, as many as it takes), a battery when asked, a mount per kW. A product the
 * installer tracks and has none of is passed over while another of its kind is in stock. Null when the catalog
 * lacks a panel or an inverter; the caller then uses the starter kit.
 */
export function catalogBom(kw, battKwh, products) {
  const active = (products || []).filter((p) => p && p.active !== false);
  const out = (p) => p.track_stock === true && !(Number(p.stock) > 0);
  // per kind: the ones in stock when there are any, else all of them
  const live = active.filter((p) => !out(p) || !active.some((q) => q.kind === p.kind && !out(q)));
  const panels = live.filter((p) => p.kind === "panel" && num(p.spec, "w") > 0).sort((a, b) => num(b.spec, "w") - num(a.spec, "w"));
  const invs = live.filter((p) => p.kind === "inverter" && num(p.spec, "kw") > 0).sort((a, b) => num(a.spec, "kw") - num(b.spec, "kw"));
  if (!panels.length || !invs.length) return null;
  const k = Math.max(0.5, Number(kw) || 0);
  const panel = panels[0];
  const lines = [line(panel, Math.max(1, Math.round((k * 1000) / num(panel.spec, "w"))))];
  // an inverter may carry up to a third more panels than its AC power
  const fits = invs.find((p) => num(p.spec, "kw") * 1.35 >= k);
  const inv = fits || invs[invs.length - 1];
  lines.push(line(inv, fits ? 1 : Math.ceil(k / (num(inv.spec, "kw") * 1.35))));
  if (battKwh > 0) {
    const bats = live.filter((p) => p.kind === "battery" && num(p.spec, "kwh") > 0);
    const bat = bats.sort((a, b) => Math.abs(num(a.spec, "kwh") - battKwh) - Math.abs(num(b.spec, "kwh") - battKwh))[0];
    if (bat) lines.push(line(bat, Math.max(1, Math.round(battKwh / num(bat.spec, "kwh")))));
  }
  const mount = live.find((p) => p.kind === "mounting");
  if (mount) lines.push(line(mount, r1(k)));
  return lines;
}

/** The equipment for the recommended size: the installer's catalog first, else the starter kit. */
export function bomFor(kw, products) {
  return catalogBom(kw, 0, products) || autoBom(kw, 0);
}
