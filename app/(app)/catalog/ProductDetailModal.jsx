"use client";
// app/(app)/catalog/ProductDetailModal.jsx — the full spec sheet for one
// supplier-catalog product. Reuses the app's existing .overlay/.modal pattern
// (see AppTheme.jsx, and the identical usage in projects/[id]/editor.jsx)
// rather than inventing a new dialog primitive. Every row it shows comes from
// lib/catalogCompare.js's compareRows() — the same list the compare table
// reads — so this can never show a spec the compare view disagrees with.
import { productImage, placeholderImage } from "../../../lib/catalogImages.js";
import { compareRows, formatRowValue } from "../../../lib/catalogCompare.js";
import { findSupplier } from "../../../lib/supplierCatalog.js";
import { t } from "../../../lib/i18n.js";

export default function ProductDetailModal({ p, lang, isAdded, addPending, onAdd, onClose }) {
  if (!p) return null;
  const sup = findSupplier(p.supplierId);
  const rows = compareRows(p.kind, lang);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cat-det-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cat-det-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cat-det-img" src={productImage(p)} alt="" width={320} height={220}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholderImage(p); }} />
          <div>
            <span className="cat-brand">{p.brand}</span>
            <h4 style={{ margin: "2px 0 0" }}>{p.model}</h4>
            <span className="cat-price" style={{ display: "block", marginTop: 6 }}>
              €{Math.round(p.price ?? p.eurPerKw)}<small>{t("cat_price_each", lang)}</small>
            </span>
          </div>
        </div>

        <table className="cat-det-table"><tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{formatRowValue(r, p)}</td>
            </tr>
          ))}
          <tr>
            <td>{t("cat_det_supplier", lang)}</td>
            <td>{sup.name}{p.leadDays > 0 ? ` · ${t("cat_sup_days", lang, { n: p.leadDays })}` : ""}</td>
          </tr>
        </tbody></table>

        <div className="cat-det-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{t("cat_det_close", lang)}</button>
          <button type="button" className={"btn " + (isAdded ? "ghost" : "primary")}
            disabled={isAdded || addPending} onClick={() => onAdd(p)}>
            {isAdded ? t("cat_sup_added", lang) : t("cat_sup_add", lang)}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cat-det-modal{width:min(560px,100%)}
        .cat-det-head{display:flex;gap:16px;align-items:flex-start;margin-bottom:14px}
        .cat-det-img{width:120px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);
          background:var(--paper);flex:none;animation:catImgIn .3s ease}
        @keyframes catImgIn{from{opacity:0}to{opacity:1}}
        .cat-det-table{width:100%;border-collapse:collapse;font-size:13px}
        .cat-det-table td{padding:7px 0;border-bottom:1px solid var(--line);color:var(--ink)}
        .cat-det-table td:first-child{color:var(--muted);width:56%}
        .cat-det-table tr:last-child td{border-bottom:none}
        .cat-det-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
      ` }} />
    </div>
  );
}
