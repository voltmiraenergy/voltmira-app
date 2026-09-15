"use client";
// app/(app)/catalog/CompareModal.jsx — side-by-side spec table for 2-3
// same-kind products. Reuses the app's .overlay/.modal pattern plus the
// table visual language already established by components/DesignSuggestions.jsx
// (.ds-table) — this is the same "compare N candidates" shape, just for
// catalog products instead of inverter suggestions.
//
// The best cell per row is bolded via lib/catalogCompare.js's bestIndex() —
// an objective min/max on a numeric spec (lowest price, highest efficiency,
// longest warranty…), never a subjective "recommended" pick.
import { productImage, placeholderImage } from "../../../lib/catalogImages.js";
import { compareRows, bestIndex } from "../../../lib/catalogCompare.js";
import { t } from "../../../lib/i18n.js";

export default function CompareModal({ items, lang, onClose }) {
  if (!items || items.length < 2) return null;
  const kind = items[0].kind;
  const rows = compareRows(kind, lang);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cat-cmp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ds-head">
          <h3 style={{ margin: 0 }}>{t("cat_cmp_title", lang)}</h3>
          <button type="button" className="btn ghost sm" onClick={onClose}>{t("cat_det_close", lang)}</button>
        </div>

        <div className="ds-scroll">
          <table className="ds-table cat-cmp-table"><tbody>
            <tr>
              <th>{t("cat_cmp_param", lang)}</th>
              {items.map((p) => (
                <th key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="cat-cmp-img" src={productImage(p)} alt="" width={160} height={110}
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholderImage(p); }} />
                  <div className="cat-brand">{p.brand}</div>
                  <div>{p.model}</div>
                </th>
              ))}
            </tr>
            {rows.map((r) => {
              const values = items.map((p) => r.get(p));
              const best = bestIndex(values, r.higherIsBetter);
              return (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  {items.map((p, i) => (
                    <td key={p.id} className={i === best ? "cat-cmp-best" : ""}>
                      {values[i] == null || values[i] === "" ? "—" : `${values[i]}${r.unit || ""}`}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td>{t("cat_field_price", lang)}</td>
              {(() => {
                const prices = items.map((p) => Number(p.price ?? p.eurPerKw) || 0);
                const best = bestIndex(prices, false);
                return items.map((p, i) => (
                  <td key={p.id} className={i === best ? "cat-cmp-best" : ""}>€{Math.round(prices[i])}</td>
                ));
              })()}
            </tr>
          </tbody></table>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cat-cmp-modal{width:min(760px,100%);max-height:88vh}
        .cat-cmp-table th{vertical-align:top;text-align:left;padding:8px 12px}
        .cat-cmp-table td:first-child{color:var(--muted);white-space:nowrap}
        .cat-cmp-img{width:80px;height:55px;object-fit:cover;border-radius:8px;border:1px solid var(--line);
          background:var(--paper);display:block;margin-bottom:6px;animation:catImgIn .3s ease}
        @keyframes catImgIn{from{opacity:0}to{opacity:1}}
        .cat-cmp-best{font-weight:700;color:var(--green);background:var(--green-tint)}
      ` }} />
    </div>
  );
}
