"use client";
// app/(app)/catalog/RecommendedKits.jsx — 4 fixed-size system bundles, each
// auto-assembled by lib/kitTiers.js from the SAME sizing logic already behind
// the BOM auto-fill button (lib/supplierCatalog.js's autoBom()) — nothing
// here invents a new recommendation engine. "Add all N items" calls the
// exact same addProduct() the manual form and the supplier browser use, once
// per BOM line; nothing bypasses that path.
import { useMemo, useState, useTransition } from "react";
import { addProduct } from "../../../lib/actions.js";
import { recommendedKits } from "../../../lib/kitTiers.js";
import { kindLabel, bomLineText } from "../../../lib/quoteAnalysis.js";
import { t } from "../../../lib/i18n.js";

const TIER_LABEL_KEY = {
  "compact-3kw": "cat_kit_compact",
  "family-6kw": "cat_kit_family",
  "family-plus-8kw": "cat_kit_familyplus",
  "business-15kw": "cat_kit_business",
};

export default function RecommendedKits({ lang, onAdded }) {
  const kits = useMemo(() => recommendedKits(), []);
  const [pending, start] = useTransition();
  const [addingId, setAddingId] = useState(null);
  const [added, setAdded] = useState(() => new Set());

  function addKit(kit) {
    if (added.has(kit.id) || pending) return;
    setAddingId(kit.id);
    start(() =>
      Promise.all(kit.bom.map((l) =>
        addProduct({
          kind: l.kind, brand: l.brand, model: l.model, spec: l.spec,
          unit_price: Math.round(l.unit_price), image_url: "",
          track_stock: false, stock: "",
        })
      )).then((rows) => {
        rows.forEach((row) => { if (row) onAdded(row); });
        setAdded((s) => new Set([...s, kit.id]));
        setAddingId(null);
      })
    );
  }

  return (
    <div className="cat-kits">
      <p className="cat-sub">{t("cat_kit_sub", lang)}</p>
      <div className="cat-kits-grid">
        {kits.map((kit) => {
          const battLine = kit.bom.find((l) => l.kind === "battery");
          const isAdded = added.has(kit.id);
          const isAdding = pending && addingId === kit.id;
          return (
            <article key={kit.id} className="cat-kit-card">
              <div className="cat-kit-head">
                <b>{kit.kw} kW — {t(TIER_LABEL_KEY[kit.id] || "cat_kit_compact", lang)}</b>
                {battLine && <span className="cat-kit-battchip">{t("cat_kit_batt_incl", lang, { n: kit.battKwh })}</span>}
              </div>

              <table className="cat-kit-table"><tbody>
                {kit.bom.map((l, i) => (
                  <tr key={i}>
                    <td className="p-kind">{kindLabel(l.kind, lang)}</td>
                    <td>{bomLineText(l)}<span className="cat-kit-qty">× {l.qty}</span></td>
                    <td className="cat-kit-price">€{Math.round(l.unit_price * l.qty).toLocaleString("en-IE")}</td>
                  </tr>
                ))}
              </tbody></table>

              <div className="cat-kit-total">
                <span>{t("cat_kit_total", lang)}</span>
                <b>€{Math.round(kit.total).toLocaleString("en-IE")}</b>
              </div>

              <button type="button" className={"btn " + (isAdded ? "ghost" : "primary")}
                disabled={isAdded || pending} onClick={() => addKit(kit)}>
                {isAdded ? t("cat_kit_added", lang) : isAdding ? "…" : t("cat_kit_add", lang, { n: kit.bom.length })}
              </button>
            </article>
          );
        })}
      </div>
      <p className="cat-sub" style={{ marginTop: 14, marginBottom: 0, fontSize: 11.5 }}>{t("cat_kit_note", lang)}</p>

      <style dangerouslySetInnerHTML={{ __html: `
        .cat-kits-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:6px}
        .cat-kit-card{border:1px solid var(--line);border-radius:14px;padding:14px 16px 16px;background:var(--paper-2);
          display:flex;flex-direction:column}
        .cat-kit-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
        .cat-kit-head b{font-size:15px;color:var(--ink);letter-spacing:-.01em}
        .cat-kit-battchip{font-size:10.5px;font-weight:700;color:var(--green);background:var(--green-tint);
          border-radius:99px;padding:2px 9px}
        .cat-kit-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px}
        .cat-kit-table td{padding:6px 0;border-bottom:1px solid var(--line);color:var(--ink);vertical-align:top}
        .cat-kit-table td.p-kind{color:var(--muted);width:1%;white-space:nowrap;padding-right:10px}
        .cat-kit-table tr:last-child td{border-bottom:none}
        .cat-kit-qty{color:var(--muted);margin-left:6px;font-variant-numeric:tabular-nums}
        .cat-kit-price{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
        .cat-kit-total{display:flex;align-items:center;justify-content:space-between;padding-top:10px;
          border-top:1px solid var(--line);margin-bottom:12px;font-size:13px;color:var(--muted)}
        .cat-kit-total b{font-size:18px;color:var(--ink);font-family:var(--font-d);letter-spacing:-.01em}
      ` }} />
    </div>
  );
}
