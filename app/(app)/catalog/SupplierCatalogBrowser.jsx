"use client";
// app/(app)/catalog/SupplierCatalogBrowser.jsx — the Sunny-Design-style
// equipment browser. A real, searchable, multi-supplier database (real brands,
// real electrical specs, real stock/lead-time per distributor) — pick one and
// it lands in YOUR OWN catalog in a click, through the exact same addProduct()
// the manual "+ Add product" form uses. Nothing here bypasses or duplicates
// that path; it just fills the form in for you from a real source instead of
// memory.
import { useMemo, useState, useTransition } from "react";
import { addProduct } from "../../../lib/actions.js";
import { ALL_SUPPLIER_PRODUCTS, SUPPLIERS, findSupplier } from "../../../lib/supplierCatalog.js";
import { t } from "../../../lib/i18n.js";

const KINDS = ["all", "panel", "inverter", "battery", "mounting"];

function specLine(p) {
  if (p.kind === "panel") return `${p.watt} Wp · Voc ${p.voc} V · ${p.eff}%`;
  if (p.kind === "inverter") return `${p.kw} kW · ${p.type} · ${p.phases === 3 ? "3~" : "1~"} · ${p.mppt} MPPT`;
  if (p.kind === "battery") return `${p.kwh} kWh · ${p.chem} · ${p.cycles.toLocaleString("en-IE")} cicluri`;
  return p.type;
}

export default function SupplierCatalogBrowser({ lang, onAdded, onClose }) {
  const [kind, setKind] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(() => new Set());

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ALL_SUPPLIER_PRODUCTS
      .filter((p) => kind === "all" || p.kind === kind)
      .filter((p) => supplier === "all" || p.supplierId === supplier)
      .filter((p) => !needle || (p.brand + " " + p.model).toLowerCase().includes(needle));
  }, [kind, supplier, q]);

  function addOne(p) {
    if (added.has(p.id) || pending) return;
    start(() =>
      addProduct({
        kind: p.kind, brand: p.brand, model: p.model, spec: p.specString,
        unit_price: Math.round(p.price ?? p.eurPerKw), image_url: "",
        track_stock: false, stock: "",
      }).then((row) => {
        if (row) { onAdded(row); setAdded((s) => new Set([...s, p.id])); }
      })
    );
  }

  return (
    <section className="card supbrowser" style={{ marginBottom: 16, borderColor: "var(--green)" }}>
      <div className="page-head" style={{ marginBottom: 4 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{t("cat_sup_title", lang)}</h2>
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>{t("cat_cancel", lang)}</button>
      </div>
      <p className="cat-sub">{t("cat_sup_sub", lang)}</p>

      <div className="cat-suppliers">
        {SUPPLIERS.map((s) => (
          <button key={s.id} type="button" className={"cat-sup-card" + (supplier === s.id ? " on" : "")}
            onClick={() => setSupplier((v) => (v === s.id ? "all" : s.id))}>
            <b>{s.name}</b>
            <span>{s.location}</span>
            <em>{s.note[lang] || s.note.en}</em>
          </button>
        ))}
      </div>

      <div className="supbrowser-toolbar">
        <div className="supbrowser-kinds">
          {KINDS.map((k) => (
            <button key={k} type="button" className={"supbrowser-chip" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>
              {t("cat_kind_" + k, lang)}
            </button>
          ))}
        </div>
        <input className="input supbrowser-search" placeholder={t("cat_sup_search", lang)} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {supplier !== "all" && (
        <div className="supbrowser-filterline">
          <b>{findSupplier(supplier).name}</b>
          <button type="button" onClick={() => setSupplier("all")}>{t("cat_sup_allsup", lang)}</button>
        </div>
      )}

      <div className="cat-grid" style={{ marginTop: 14 }}>
        {rows.map((p) => {
          const sup = findSupplier(p.supplierId);
          const inStock = p.stock > 0;
          const isAdded = added.has(p.id);
          return (
            <article key={p.id} className="cat-card supbrowser-card">
              <div className="cat-body">
                <span className="cat-brand">{p.brand}</span>
                <span className="cat-name">{p.model}</span>
                <span className="cat-spec">{specLine(p)}</span>
                <div className="supbrowser-stockrow">
                  <span className={"cat-stock " + (inStock ? "ok" : "low")}>
                    {inStock ? t("cat_sup_instock", lang, { n: p.stock }) : t("cat_sup_order", lang)}
                  </span>
                  {p.leadDays > 0 && <span className="supbrowser-lead">{t("cat_sup_days", lang, { n: p.leadDays })}</span>}
                </div>
                <span className="supbrowser-supname">{sup.name}</span>
                <div className="cat-foot">
                  <span className="cat-price">€{Math.round(p.price ?? p.eurPerKw)}<small>{t("cat_price_each", lang)}</small></span>
                  <button type="button" className={"btn sm " + (isAdded ? "ghost" : "primary")} style={{ marginLeft: "auto" }}
                    disabled={isAdded || pending} onClick={() => addOne(p)}>
                    {isAdded ? t("cat_sup_added", lang) : t("cat_sup_add", lang)}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {rows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>{t("cat_sup_none", lang)}</p>}
      </div>

      <p className="cat-sub" style={{ marginTop: 14, marginBottom: 0, fontSize: 11.5 }}>{t("cat_sup_note", lang)}</p>
    </section>
  );
}
