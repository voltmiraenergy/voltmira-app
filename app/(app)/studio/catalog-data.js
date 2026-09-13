// app/(app)/studio/catalog-data.js — Studio's view onto the shared supplier
// database (lib/supplierCatalog.js), so a Studio demo never disagrees with the
// real Catalog. Everything product/supplier-shaped lives there; this file adds
// only the Studio-specific layer: resolving a mock client's panelId/inverterId/
// batteryId/mountId into the actual system it's quoted on.
export {
  SUPPLIERS, PANELS, INVERTERS, BATTERIES, MOUNTS, DEFAULT_IDS, ALL_SUPPLIER_PRODUCTS,
  findSupplier, findPanel, findInverter, findBattery, findMount,
  recommendInverter, recommendBattery, recommendPanel,
} from "../../../lib/supplierCatalog.js";

import {
  findPanel, findInverter, findBattery, findMount,
  PANELS as _PANELS, INVERTERS as _INVERTERS, BATTERIES as _BATTERIES, MOUNTS as _MOUNTS,
} from "../../../lib/supplierCatalog.js";

// The system a given client is quoted on. Every surface calls this instead of
// reading a shared constant, so changing the pick in the Catalog surface (or
// the inline picker in the offer) ripples into the quote, the annex and the
// install schedule together.
export function systemFor(client) {
  return {
    panel: findPanel(client?.panelId),
    inverter: findInverter(client?.inverterId),
    battery: findBattery(client?.batteryId),
    mount: findMount(client?.mountId),
  };
}

export const ALL_PRODUCTS = [
  ..._PANELS.map((p) => ({ ...p, kind: "panou" })),
  ..._INVERTERS.map((p) => ({ ...p, kind: "invertor" })),
  ..._BATTERIES.map((p) => ({ ...p, kind: "baterie" })),
  ..._MOUNTS.map((p) => ({ ...p, kind: "structura" })),
];
