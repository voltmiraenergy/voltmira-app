"use client";
// app/(app)/catalog/MyProductDetailModal.jsx — the full spec sheet for a
// product in the INSTALLER'S OWN catalog, opened by clicking its card in
// CatalogManager.jsx (which previously had no click behaviour at all — only
// the tiny edit/delete icons worked).
//
// A personal-catalog row only ever carries {kind, brand, model, spec,
// cost_price, unit_price, image_url, track_stock, stock} — none of the real
// electrical specs or warranty terms a supplier SKU carries. Most personal
// products WERE added from the supplier browser to begin with (same brand +
// model), so this looks the verified SKU back up by that exact match
// (lib/supplierCatalog.js's findSupplierProduct — same brand+model matching
// findWarrantyInfo already uses elsewhere) and, when found, shows the exact
// same spec table ProductDetailModal.jsx shows for a supplier row — same
// compareRows()/formatRowValue() functions, so the two views can never
// disagree. A hand-typed custom product with no such match still opens the
// modal; it just shows only what's real (own price/spec), never a guessed
// spec or warranty.
import { compareRows, formatRowValue } from "../../../lib/catalogCompare.js";
import { findSupplierProduct } from "../../../lib/supplierCatalog.js";
import { productImage, placeholderImage } from "../../../lib/catalogImages.js";
import { t } from "../../../lib/i18n.js";

export default function MyProductDetailModal({ p, lang, onClose, onEdit }) {
  if (!p) return null;
  const sup = findSupplierProduct(p.brand, p.model);
  // Same honesty guard findWarrantyInfo applies: an unverified warranty
  // figure on the matched record must never reach this table either.
  const supForRows = sup && sup.warrantyVerified === false
    ? { ...sup, warrantyYears: null, warrantyNote: null } : sup;
  const rows = sup ? compareRows(sup.kind, lang) : [];
  const fmt = (n) => "€" + Math.round(Number(n) || 0).toLocaleString("en-IE");
  const img = p.image_url || (sup ? productImage(sup) : placeholderImage({ kind: p.kind }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cat-det-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cat-det-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cat-det-img" src={img} alt="" width={320} height={220}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholderImage({ kind: p.kind }); }} />
          <div>
            {p.brand && <span className="cat-brand">{p.brand}</span>}
            <h4 style={{ margin: "2px 0 0" }}>{p.model || p.brand || t("cat_untitled", lang)}</h4>
            {p.spec && <span className="cat-spec" style={{ marginTop: 5 }}>{p.spec}</span>}
            <span className="cat-price" style={{ display: "block", marginTop: 6 }}>
              {fmt(p.unit_price)}<small>{t("cat_price_each", lang)}</small>
            </span>
          </div>
        </div>

        {sup ? (
          <table className="cat-det-table"><tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{formatRowValue(r, supForRows)}</td>
              </tr>
            ))}
            {sup.productUrl && (
              <tr><td>{t("cat_det_datasheet", lang)}</td>
                <td><a href={sup.productUrl} target="_blank" rel="noopener noreferrer">↗ {sup.brand}</a></td></tr>
            )}
          </tbody></table>
        ) : (
          <p className="cat-det-nomatch">{t("cat_det_no_match", lang)}</p>
        )}

        <div className="cat-det-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{t("cat_det_close", lang)}</button>
          {onEdit && (
            <button type="button" className="btn primary" onClick={() => { onClose(); onEdit(p); }}>
              {t("cat_edit", lang)}
            </button>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cat-det-modal{width:min(560px,100%)}
        .cat-det-head{display:flex;gap:16px;align-items:flex-start;margin-bottom:14px}
        .cat-det-img{width:120px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);
          background:var(--paper);flex:none}
        .cat-det-table{width:100%;border-collapse:collapse;font-size:13px}
        .cat-det-table td{padding:7px 0;border-bottom:1px solid var(--line);color:var(--ink)}
        .cat-det-table td:first-child{color:var(--muted);width:56%}
        .cat-det-table tr:last-child td{border-bottom:none}
        .cat-det-table a{color:var(--green);font-weight:600;text-decoration:none}
        .cat-det-nomatch{font-size:12.5px;color:var(--muted);line-height:1.5;background:var(--paper);
          border:1px dashed var(--line);border-radius:10px;padding:12px}
        .cat-det-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
      ` }} />
    </div>
  );
}
