// lib/csvImport.js — parsing and validation for the installer's own CSV
// catalog upload (app/(app)/catalog/CsvImportPanel.jsx). Pure functions, no
// React, no I/O — testable the same way as the rest of lib/.
//
// Rows are re-normalized through the SAME shape lib/actions.js's
// addProduct()/cleanProduct() expect for a single manually-typed product, so
// a bulk-imported row can never reach the catalog under looser validation
// than the form does — lib/actions.js's bulkAddProducts() re-runs its own
// normalizers server-side regardless, this is the client-side preview.

const KINDS = ["panel", "inverter", "battery", "mounting", "other"];
const MAX_ROWS = 500;

export const CSV_TEMPLATE_HEADER = ["kind", "brand", "model", "spec", "cost_price", "unit_price", "stock"];
const CSV_TEMPLATE_EXAMPLE = ["panel", "Jinko", "Tiger Neo 425W", "425 W", "60", "74", "50"];

function csvField(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The downloadable starting-point CSV: header + one filled example row. */
export function productCsvTemplate() {
  return [CSV_TEMPLATE_HEADER, CSV_TEMPLATE_EXAMPLE].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/**
 * RFC4180-ish CSV parse: quoted fields (embedded commas/newlines/escaped ""),
 * bare fields, \r\n or \n line endings, an optional leading UTF-8 BOM. No
 * header handling — the caller does that. Returns an array of rows, each an
 * array of string cells; trailing blank lines are dropped.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const s = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/**
 * Turns parsed CSV rows (first row = header, matched by name, case-
 * insensitive, any column order, unrecognized columns ignored) into
 * normalized product patches plus a per-row status, capped at 500 data rows.
 * @returns {{valid: object[], results: {rowNum:number, ok:boolean, error?:string, errorArgs?:object, patch?:object}[], truncated: boolean}}
 */
export function normalizeProductRows(csvRows) {
  if (!Array.isArray(csvRows) || csvRows.length < 2) return { valid: [], results: [], truncated: false };
  const header = csvRows[0].map((h) => String(h || "").trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const iKind = idx("kind"), iBrand = idx("brand"), iModel = idx("model"), iSpec = idx("spec"),
    iCost = idx("cost_price"), iPrice = idx("unit_price"), iStock = idx("stock"), iImage = idx("image_url");

  const dataRows = csvRows.slice(1).filter((r) => r.some((c) => String(c || "").trim() !== ""));
  const truncated = dataRows.length > MAX_ROWS;
  const rows = dataRows.slice(0, MAX_ROWS);

  const valid = [];
  const results = rows.map((r, i) => {
    const rowNum = i + 2; // header is row 1, data starts at row 2
    const get = (j) => (j >= 0 ? String(r[j] ?? "").trim() : "");
    const kindRaw = get(iKind).toLowerCase();
    const kind = KINDS.includes(kindRaw) ? kindRaw : null;
    if (!kind) return { rowNum, ok: false, error: "cat_imp_row_kind", errorArgs: { v: get(iKind) || "—" } };

    const brand = get(iBrand).slice(0, 80), model = get(iModel).slice(0, 80);
    if (!brand && !model) return { rowNum, ok: false, error: "cat_imp_row_name" };

    const priceRaw = get(iPrice);
    const price = priceRaw === "" ? 0 : Number(priceRaw);
    if (!Number.isFinite(price)) return { rowNum, ok: false, error: "cat_imp_row_price", errorArgs: { v: priceRaw } };

    const costRaw = get(iCost);
    const cost = costRaw === "" ? 0 : Number(costRaw);
    if (!Number.isFinite(cost)) return { rowNum, ok: false, error: "cat_imp_row_price", errorArgs: { v: costRaw } };

    const stockRaw = get(iStock);
    const hasStock = stockRaw !== "" && Number.isFinite(Number(stockRaw));
    const patch = {
      kind, brand, model, spec: get(iSpec).slice(0, 60),
      cost_price: Math.max(0, cost), unit_price: Math.max(0, price),
      track_stock: hasStock, stock: hasStock ? Math.max(0, Math.round(Number(stockRaw))) : 0,
      image_url: get(iImage),
    };
    valid.push(patch);
    return { rowNum, ok: true, patch };
  });
  return { valid, results, truncated };
}
