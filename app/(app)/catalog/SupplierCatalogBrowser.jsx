"use client";
// app/(app)/catalog/SupplierCatalogBrowser.jsx — the Sunny-Design-style
// equipment browser. A real, searchable, multi-supplier database (real brands,
// real electrical specs, real stock/lead-time per distributor) — pick one and
// it lands in YOUR OWN catalog in a click, through the exact same addProduct()
// the manual "+ Add product" form uses. Nothing here bypasses or duplicates
// that path; it just fills the form in for you from a real source instead of
// memory.
//
// Rebuilt as a filter-sidebar + grid (category, brand, power/capacity range,
// price range, in-stock-only), a per-product detail modal, and a 2-3-way
// compare mode — the filtering/sizing/comparison logic itself lives in
// lib/catalogFilters.js and lib/catalogCompare.js so it's unit-tested and
// shared with nothing duplicating it.
import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { addProduct } from "../../../lib/actions.js";
import { ALL_SUPPLIER_PRODUCTS, SUPPLIERS, findSupplier } from "../../../lib/supplierCatalog.js";
import { brandsFor, sizeRangeFor, priceRangeFor, filterProducts } from "../../../lib/catalogFilters.js";
import { t } from "../../../lib/i18n.js";
import ProductCard from "./ProductCard.jsx";
import ProductDetailModal from "./ProductDetailModal.jsx";
import CompareModal from "./CompareModal.jsx";
import RecommendedKits from "./RecommendedKits.jsx";

const KINDS = ["all", "panel", "inverter", "battery", "mounting"];
const SIZE_LABEL_KEY = { panel: "cat_sup_range_power", inverter: "cat_sup_range_ac", battery: "cat_sup_range_cap" };
const SIZE_UNIT = { panel: "Wp", inverter: "kW", battery: "kWh" };

const fillPct = (v, lo, hi) => (hi > lo ? Math.round(((v - lo) / (hi - lo)) * 100) : 0);

export default function SupplierCatalogBrowser({ lang, onAdded, onClose }) {
  // Deep-link support (?detail=<id>, ?compare=<id>,<id>, ?kind=panel|inverter|…)
  // — safe against static, hardcoded catalog ids (unlike a proposal `code`,
  // these never change per visitor/session, so no server lookup is needed).
  const searchParams = useSearchParams();
  // ?tab=kits deep-links straight to the Recommended Kits tab.
  const [tab, setTab] = useState(() => (searchParams.get("tab") === "kits" ? "kits" : "browse"));
  const compareInitItems = useMemo(() => {
    const raw = searchParams.get("compare");
    const ids = raw ? raw.split(",").slice(0, 3).filter(Boolean) : [];
    return ALL_SUPPLIER_PRODUCTS.filter((p) => ids.includes(p.id));
  }, [searchParams]);

  const [kind, setKind] = useState(() => {
    if (compareInitItems.length) return compareInitItems[0].kind;
    const k = searchParams.get("kind");
    return KINDS.includes(k) ? k : "all";
  });
  const [supplier, setSupplier] = useState("all");
  const [q, setQ] = useState("");
  const [brands, setBrands] = useState(() => new Set());
  const [sizeMin, setSizeMin] = useState(null); // null = "not touched yet", falls back to the full bound
  const [sizeMax, setSizeMax] = useState(null);
  const [priceMin, setPriceMin] = useState(null);
  const [priceMax, setPriceMax] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(() => new Set());
  const [detailProduct, setDetailProduct] = useState(() => {
    const id = searchParams.get("detail");
    return id ? (ALL_SUPPLIER_PRODUCTS.find((p) => p.id === id) || null) : null;
  });
  const [compareSet, setCompareSet] = useState(() => new Set(compareInitItems.map((p) => p.id)));
  const [compareOpen, setCompareOpen] = useState(() => compareInitItems.length >= 2);
  // Collapsed by default only below the sidebar/grid breakpoint (CSS decides
  // when the toggle button itself is even visible) — on desktop the sidebar
  // always shows regardless of this flag.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Rows for the current category + supplier only — this is what brand
  // options and the range-slider bounds are drawn from, so a stray filter
  // (e.g. a brand only sold as an inverter) can't hide itself once you switch
  // category.
  const kindRows = useMemo(
    () => ALL_SUPPLIER_PRODUCTS.filter((p) => kind === "all" || p.kind === kind)
      .filter((p) => supplier === "all" || p.supplierId === supplier),
    [kind, supplier],
  );
  const brandOptions = useMemo(() => brandsFor(kindRows), [kindRows]);
  const sizeBounds = useMemo(() => (kind === "all" || kind === "mounting" ? null : sizeRangeFor(kindRows)), [kindRows, kind]);
  const priceBounds = useMemo(() => priceRangeFor(kindRows), [kindRows]);

  const effSizeMin = sizeMin ?? sizeBounds?.min ?? 0;
  const effSizeMax = sizeMax ?? sizeBounds?.max ?? 0;
  const effPriceMin = priceMin ?? priceBounds?.min ?? 0;
  const effPriceMax = priceMax ?? priceBounds?.max ?? 0;

  const rows = useMemo(() => filterProducts(ALL_SUPPLIER_PRODUCTS, {
    kind, supplier, q, brands: Array.from(brands),
    minSize: sizeBounds ? effSizeMin : null, maxSize: sizeBounds ? effSizeMax : null,
    minPrice: priceBounds ? effPriceMin : null, maxPrice: priceBounds ? effPriceMax : null,
    inStockOnly,
  }), [kind, supplier, q, brands, sizeBounds, effSizeMin, effSizeMax, priceBounds, effPriceMin, effPriceMax, inStockOnly]);

  const compareEnabled = kind !== "all";
  const compareItems = useMemo(
    () => ALL_SUPPLIER_PRODUCTS.filter((p) => compareSet.has(p.id)),
    [compareSet],
  );

  function selectKind(k) {
    setKind(k);
    setBrands(new Set());
    setSizeMin(null); setSizeMax(null);
    setPriceMin(null); setPriceMax(null);
    setCompareSet(new Set());
  }

  function toggleBrand(b) {
    setBrands((s) => {
      const next = new Set(s);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }

  function toggleCompare(p) {
    setCompareSet((s) => {
      const next = new Set(s);
      if (next.has(p.id)) next.delete(p.id);
      else if (next.size < 3) next.add(p.id);
      return next;
    });
  }

  function clearFilters() {
    setSupplier("all"); setQ(""); setBrands(new Set());
    setSizeMin(null); setSizeMax(null); setPriceMin(null); setPriceMax(null);
    setInStockOnly(false);
  }

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

      <div className="supbrowser-toptabs">
        <button type="button" className={"supbrowser-toptab" + (tab === "browse" ? " on" : "")} onClick={() => setTab("browse")}>
          {t("cat_tab_browse", lang)}
        </button>
        <button type="button" className={"supbrowser-toptab" + (tab === "kits" ? " on" : "")} onClick={() => setTab("kits")}>
          {t("cat_tab_kits", lang)}
        </button>
      </div>

      {tab === "kits" ? (
        <RecommendedKits lang={lang} onAdded={onAdded} />
      ) : (
      <>
      <div className="supbrowser-kinds" style={{ marginTop: 10 }}>
        {KINDS.map((k) => (
          <button key={k} type="button" className={"supbrowser-chip" + (kind === k ? " on" : "")} onClick={() => selectKind(k)}>
            {t("cat_kind_" + k, lang)}
          </button>
        ))}
      </div>

      <button type="button" className={"supbrowser-filtertoggle" + (filtersOpen ? " open" : "")}
        onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
        <span>{t("cat_sup_filters", lang)}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      <div className="supbrowser-layout">
        <aside className={"supbrowser-sidebar" + (filtersOpen ? " open" : "")}>
          <div className="supbrowser-sb-head">
            <b>{t("cat_sup_filters", lang)}</b>
            <button type="button" className="supbrowser-clear" onClick={clearFilters}>{t("cat_sup_clear", lang)}</button>
          </div>

          <input className="input supbrowser-search" placeholder={t("cat_sup_search", lang)} value={q} onChange={(e) => setQ(e.target.value)} />

          <div className="supbrowser-sb-group">
            <h3>{t("cat_sup_instock_only", lang)}</h3>
            <label className="supbrowser-check">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              {t("cat_sup_instock_only", lang)}
            </label>
          </div>

          <div className="supbrowser-sb-group">
            <h3>{t("cat_sup_brand", lang)}</h3>
            {brandOptions.map((b) => (
              <label key={b} className="supbrowser-check">
                <input type="checkbox" checked={brands.has(b)} onChange={() => toggleBrand(b)} />
                {b}
              </label>
            ))}
          </div>

          {sizeBounds && sizeBounds.max > sizeBounds.min && (
            <div className="supbrowser-sb-group">
              <h3>{t(SIZE_LABEL_KEY[kind] || "cat_sup_range_power", lang)}</h3>
              <div className="supbrowser-range-summary">{effSizeMin} – {effSizeMax} {SIZE_UNIT[kind] || ""}</div>
              <div className="supbrowser-range">
                <span>{t("cat_sup_range_min", lang)}</span>
                <div className="slider-row">
                  <input type="range" min={sizeBounds.min} max={sizeBounds.max} value={effSizeMin}
                    style={{ "--fill": fillPct(effSizeMin, sizeBounds.min, sizeBounds.max) + "%" }}
                    onChange={(e) => setSizeMin(Math.min(Number(e.target.value), effSizeMax))} />
                  <input type="number" className="slider-num" min={sizeBounds.min} max={sizeBounds.max} value={effSizeMin}
                    onChange={(e) => setSizeMin(Math.min(Math.max(Number(e.target.value) || sizeBounds.min, sizeBounds.min), effSizeMax))} />
                </div>
              </div>
              <div className="supbrowser-range">
                <span>{t("cat_sup_range_max", lang)}</span>
                <div className="slider-row">
                  <input type="range" min={sizeBounds.min} max={sizeBounds.max} value={effSizeMax}
                    style={{ "--fill": fillPct(effSizeMax, sizeBounds.min, sizeBounds.max) + "%" }}
                    onChange={(e) => setSizeMax(Math.max(Number(e.target.value), effSizeMin))} />
                  <input type="number" className="slider-num" min={sizeBounds.min} max={sizeBounds.max} value={effSizeMax}
                    onChange={(e) => setSizeMax(Math.max(Math.min(Number(e.target.value) || sizeBounds.max, sizeBounds.max), effSizeMin))} />
                </div>
              </div>
            </div>
          )}

          {priceBounds && priceBounds.max > priceBounds.min && (
            <div className="supbrowser-sb-group">
              <h3>{t("cat_sup_range_price", lang)}</h3>
              <div className="supbrowser-range-summary">€{effPriceMin} – €{effPriceMax}</div>
              <div className="supbrowser-range">
                <span>{t("cat_sup_range_min", lang)} (€)</span>
                <div className="slider-row">
                  <input type="range" min={priceBounds.min} max={priceBounds.max} value={effPriceMin}
                    style={{ "--fill": fillPct(effPriceMin, priceBounds.min, priceBounds.max) + "%" }}
                    onChange={(e) => setPriceMin(Math.min(Number(e.target.value), effPriceMax))} />
                  <input type="number" className="slider-num" min={priceBounds.min} max={priceBounds.max} value={effPriceMin}
                    onChange={(e) => setPriceMin(Math.min(Math.max(Number(e.target.value) || priceBounds.min, priceBounds.min), effPriceMax))} />
                </div>
              </div>
              <div className="supbrowser-range">
                <span>{t("cat_sup_range_max", lang)} (€)</span>
                <div className="slider-row">
                  <input type="range" min={priceBounds.min} max={priceBounds.max} value={effPriceMax}
                    style={{ "--fill": fillPct(effPriceMax, priceBounds.min, priceBounds.max) + "%" }}
                    onChange={(e) => setPriceMax(Math.max(Number(e.target.value), effPriceMin))} />
                  <input type="number" className="slider-num" min={priceBounds.min} max={priceBounds.max} value={effPriceMax}
                    onChange={(e) => setPriceMax(Math.max(Math.min(Number(e.target.value) || priceBounds.max, priceBounds.max), effPriceMin))} />
                </div>
              </div>
            </div>
          )}

          <div className="supbrowser-sb-group">
            <h3>{t("cat_sup_allsup", lang)}</h3>
            {SUPPLIERS.map((s) => (
              <button key={s.id} type="button" className={"cat-sup-card" + (supplier === s.id ? " on" : "")}
                onClick={() => setSupplier((v) => (v === s.id ? "all" : s.id))}>
                <b>{s.name}</b>
                <span>{s.location}</span>
                <em>{s.note[lang] || s.note.en}</em>
              </button>
            ))}
          </div>
        </aside>

        <div className="supbrowser-main">
          <div className="supbrowser-resultline">
            <span>{t("cat_sup_results", lang, { n: rows.length, of: kindRows.length })}</span>
            {kind === "all" && <em className="supbrowser-cmphint">{t("cat_cmp_hint", lang)}</em>}
          </div>

          <div className="cat-grid">
            {rows.map((p) => (
              <ProductCard
                key={p.id} p={p} lang={lang}
                supplierName={findSupplier(p.supplierId).name}
                isAdded={added.has(p.id)} addPending={pending} onAdd={addOne}
                onOpenDetail={setDetailProduct}
                compareEnabled={compareEnabled} isCompared={compareSet.has(p.id)}
                compareFull={compareSet.size >= 3} onToggleCompare={toggleCompare}
              />
            ))}
            {rows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>{t("cat_sup_none", lang)}</p>}
          </div>
        </div>
      </div>

      {compareEnabled && compareSet.size > 0 && (
        <div className="supbrowser-cmpbar">
          <span>{t("cat_cmp_bar", lang, { n: compareSet.size })}</span>
          <span className="supbrowser-cmpbar-hint">{t("cat_cmp_max", lang)}</span>
          <span className="spacer" />
          <button type="button" className="btn ghost sm" onClick={() => setCompareSet(new Set())}>{t("cat_cmp_clear", lang)}</button>
          <button type="button" className="btn primary sm" disabled={compareSet.size < 2} onClick={() => setCompareOpen(true)}>
            {t("cat_cmp_open", lang)}
          </button>
        </div>
      )}

      <p className="cat-sub" style={{ marginTop: 14, marginBottom: 0, fontSize: 11.5 }}>{t("cat_sup_note", lang)}</p>
      </>
      )}

      {detailProduct && (
        <ProductDetailModal
          p={detailProduct} lang={lang}
          isAdded={added.has(detailProduct.id)} addPending={pending}
          onAdd={addOne} onClose={() => setDetailProduct(null)}
        />
      )}
      {compareOpen && (
        <CompareModal items={compareItems} lang={lang} onClose={() => setCompareOpen(false)} />
      )}
    </section>
  );
}
