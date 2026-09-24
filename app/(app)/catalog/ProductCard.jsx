"use client";
// app/(app)/catalog/ProductCard.jsx — one supplier-catalog card: hero image,
// brand/model, key spec line, compat hint, stock/lead time, price, a compare
// checkbox and the existing "Add to catalog" button. Extracted out of
// SupplierCatalogBrowser.jsx so the grid component stays about layout/state,
// not per-card markup.
import { productImage, placeholderImage } from "../../../lib/catalogImages.js";
import { compatibleInverters, compatiblePanels } from "../../../lib/stringDesign.js";
import { PANELS, INVERTERS } from "../../../lib/supplierCatalog.js";
import { t } from "../../../lib/i18n.js";

function specLine(p) {
  if (p.kind === "panel") return `${p.watt} Wp · Voc ${p.voc} V · ${p.eff}%`;
  if (p.kind === "inverter") return `${p.kw} kW · ${p.type} · ${p.phases === 3 ? "3~" : "1~"} · ${p.mppt} MPPT`;
  if (p.kind === "battery") return `${p.kwh} kWh · ${p.chem} · ${p.cycles.toLocaleString("en-IE")} cicluri`;
  return p.type;
}

// The string-design rules (lib/stringDesign.js) answer "can these two be
// wired together at all" for a single pair; here it's just run against the
// whole opposite list and counted — a panel or inverter card can say up front
// how much of the rest of the catalog it can actually be strung to, instead of
// an installer finding out by trial and error deep in a quote.
function compatCount(p) {
  if (p.kind === "panel") return { n: compatibleInverters(p, INVERTERS).length, of: INVERTERS.length };
  if (p.kind === "inverter") return { n: compatiblePanels(p, PANELS).length, of: PANELS.length };
  return null;
}

export default function ProductCard({
  p, lang, supplierName, isAdded, addPending, onAdd, onOpenDetail,
  compareEnabled, isCompared, compareFull, onToggleCompare,
}) {
  const inStock = p.stock > 0;
  const compat = compatCount(p);

  return (
    <article className="cat-card supbrowser-card">
      {compareEnabled && (
        <label className="supbrowser-cmp" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isCompared}
            disabled={!isCompared && compareFull}
            onChange={() => onToggleCompare(p)}
          />
          {t("cat_cmp_pick", lang)}
        </label>
      )}
      <button type="button" className="supbrowser-imgbtn" onClick={() => onOpenDetail(p)} aria-label={p.model}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="supbrowser-img" src={productImage(p)} alt="" loading="lazy" width={320} height={220}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholderImage(p); }} />
      </button>
      <div className="cat-body">
        <button type="button" className="supbrowser-namebtn" onClick={() => onOpenDetail(p)}>
          <span className="cat-brand">{p.brand}</span>
          <span className="cat-name">{p.model}</span>
        </button>
        <span className="cat-spec">{specLine(p)}</span>
        {compat && (
          <span className={"supbrowser-compat" + (compat.n === 0 ? " none" : "")}>
            {compat.n === 0
              ? t(p.kind === "panel" ? "cat_sup_compat_none_inv" : "cat_sup_compat_none_panel", lang)
              : t(p.kind === "panel" ? "cat_sup_compat_inv" : "cat_sup_compat_panel", lang, { n: compat.n, of: compat.of })}
          </span>
        )}
        <div className="supbrowser-stockrow">
          <span className={"cat-stock " + (inStock ? "ok" : "low")}>
            {inStock ? t("cat_sup_instock", lang, { n: p.stock }) : t("cat_sup_order", lang)}
          </span>
          {p.leadDays > 0 && <span className="supbrowser-lead">{t("cat_sup_days", lang, { n: p.leadDays })}</span>}
        </div>
        <span className="supbrowser-supname">{supplierName}</span>
        <div className="cat-foot">
          <span className="cat-price">€{Math.round(p.price ?? p.eurPerKw)}<small>{t("cat_price_each", lang)}</small></span>
          <button type="button" className={"btn sm " + (isAdded ? "ghost" : "primary")} style={{ marginLeft: "auto" }}
            disabled={isAdded || addPending} onClick={() => onAdd(p)}>
            {isAdded ? t("cat_sup_added", lang) : t("cat_sup_add", lang)}
          </button>
        </div>
      </div>
    </article>
  );
}
