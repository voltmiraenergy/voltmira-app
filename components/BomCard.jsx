"use client";
// components/BomCard.jsx — the bill of materials, finally reachable from the
// offer itself.
//
// The `projects.bom` column and its migration have existed since add-quote-bom.sql,
// and lib/quoteInput.js documents exactly what it is for — "the installer's
// equipment cost, shown in the editor as a margin figure (quote price −
// materials)" — but no editor UI ever shipped, so the column stayed empty and
// the catalog the page already loads went unused.
//
// Two sources, one list:
//  · the company's own catalog (the `products` table behind /catalog)
//  · the supplier database (lib/supplierCatalog.js), so an installer who hasn't
//    filled their catalog yet can still build a real BOM — the same SKUs the
//    /catalog browser imports from.
//
// Auto-fill sizes a whole system for the current kW/battery in one click:
// modules to cover the array, a phase-matched inverter, an LFP battery near the
// target capacity, and mounting per kWp.
import { useMemo, useState } from "react";
import {
  ALL_SUPPLIER_PRODUCTS, recommendInverter, recommendBattery, recommendPanel,
  findMount, findSupplier, DEFAULT_IDS,
} from "../lib/supplierCatalog.js";
import { bomTotal, kindLabel } from "../lib/quoteAnalysis.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);


/**
 * Size a complete system for this kW / battery target.
 * Single-phase under 6 kW, three-phase above — the split every MD/RO installer
 * uses, and what decides which inverters are even eligible.
 */
export function autoBom(kw, battKwh) {
  const panel = recommendPanel();
  const nPanels = Math.max(1, Math.round((kw * 1000) / panel.watt));
  const phases = kw > 6 ? 3 : 1;
  const inv = recommendInverter({ kw, phases, wantHybrid: battKwh > 0 });
  const mount = findMount(DEFAULT_IDS.mount);
  const lines = [
    { kind: "panel", brand: panel.brand, model: panel.model, spec: `${panel.watt} W`, qty: nPanels, unit_price: panel.price, source: "supplier" },
    { kind: "inverter", brand: inv.brand, model: inv.model, spec: `${inv.kw} kW ${inv.type}`, qty: Math.max(1, Math.ceil(kw / (inv.kw * 1.35))), unit_price: inv.price, source: "supplier" },
    { kind: "mounting", brand: mount.brand, model: mount.model, spec: mount.type, qty: Math.round(kw * 10) / 10, unit_price: mount.eurPerKw, source: "supplier" },
  ];
  if (battKwh > 0) {
    const bat = recommendBattery(battKwh);
    if (bat) lines.splice(2, 0, {
      kind: "battery", brand: bat.brand, model: bat.model, spec: `${bat.kwh} kWh ${bat.chem}`,
      qty: Math.max(1, Math.round(battKwh / bat.kwh)), unit_price: bat.price, source: "supplier",
    });
  }
  return lines;
}

/**
 * @param {Array}  bom       current lines
 * @param {(b:Array)=>void} onChange
 * @param {Array}  catalog   the company's own `products` rows
 * @param {number} kw, battKwh   for auto-fill
 * @param {number} quotePrice    the quote's gross price, for the margin figure
 * @param {(e:number)=>string} money
 */
export default function BomCard({
  lang, bom = [], onChange, catalog = [], kw = 0, battKwh = 0, quotePrice = 0, money, className = "card",
}) {
  const [picking, setPicking] = useState(null); // null | "own" | "supplier"
  const [q, setQ] = useState("");

  const materials = useMemo(() => bomTotal(bom), [bom]);
  const margin = quotePrice - materials;
  const marginPct = quotePrice > 0 ? (margin / quotePrice) * 100 : 0;

  // Lines from the company's own catalog carry productId, which is what ties a
  // quote back to inventory: /catalog counts committed units per productId and
  // deducts them from stock once the deal is won. Without it that whole feature
  // is inert — it reads a field the BOM never wrote.
  //
  // Cost basis is the purchase price when the installer has set one; a product
  // that only has a list price falls back to it, which is what happened for
  // every product before add-product-cost.sql existed.
  const ownRows = useMemo(() => (catalog || []).map((r) => ({
    key: "own-" + r.id, productId: r.id,
    kind: r.kind || "other", brand: r.brand || "", model: r.model || "",
    spec: r.spec || "", unit_price: Number(r.cost_price) > 0 ? Number(r.cost_price) : (Number(r.unit_price) || 0),
    meta: r.track_stock ? `${r.stock ?? 0} ${t3(lang, "în stoc", "in stock", "в наличии")}` : "",
  })), [catalog, lang]);

  const supplierRows = useMemo(() => ALL_SUPPLIER_PRODUCTS.map((p) => ({
    key: "sup-" + p.id, kind: p.kind, brand: p.brand, model: p.model, spec: p.specString,
    unit_price: Number(p.price ?? p.eurPerKw) || 0,
    meta: `${findSupplier(p.supplierId).name} · ${p.stock > 0 ? `${p.stock} ${t3(lang, "în stoc", "in stock", "в наличии")}` : t3(lang, "comandă", "order", "заказ")}`,
  })), [lang]);

  const pool = picking === "own" ? ownRows : supplierRows;
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? pool.filter((r) => `${r.brand} ${r.model} ${r.spec} ${kindLabel(r.kind, lang)}`.toLowerCase().includes(needle))
    : pool;

  const setLine = (i, patch) => onChange(bom.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = (r) => {
    onChange([...bom, {
      kind: r.kind, brand: r.brand, model: r.model, spec: r.spec,
      qty: 1, unit_price: r.unit_price, source: picking,
      // only own-catalog rows have one; supplier SKUs aren't your stock
      ...(r.productId ? { productId: r.productId } : {}),
    }]);
    setPicking(null); setQ("");
  };

  return (
    <section className={className}>
      <div className="bom-head">
        <h3 style={{ margin: 0, flex: 1 }}>{t3(lang, "Echipament & deviz", "Equipment & bill of materials", "Оборудование и смета")}</h3>
        {bom.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={() => onChange([])}>
            {t3(lang, "golește", "clear", "очистить")}
          </button>
        )}
      </div>
      <p className="bom-lead">
        {t3(lang,
          "Ce intră fizic în sistem, la prețurile tale de achiziție. Nu schimbă prețul din ofertă — acesta rămâne condus de puterea sistemului — ci arată marja: preț ofertă minus materiale.",
          "What physically goes into the system, at your purchase prices. It doesn't change the quoted price — that stays driven by system size — it shows the margin: quote price minus materials.",
          "Что физически входит в систему, по вашим закупочным ценам. Цена предложения не меняется — она зависит от мощности — но виден маржинальный доход: цена минус материалы.")}
      </p>

      {bom.length === 0 && (
        <div className="bom-empty">
          {t3(lang, "Niciun articol încă.", "No items yet.", "Пока пусто.")}
        </div>
      )}

      {bom.length > 0 && (
        <div className="bom-table" role="table">
          {bom.map((l, i) => (
            <div className="bom-row" role="row" key={i}>
              {/* The product name gets the full width: a model like
                  "Hi-MO 9 LR7-72HGD" wrapped to four lines when it shared a
                  grid row with the number inputs in the narrow inputs column. */}
              <div className="bom-desc">
                <b>{l.brand} {l.model}</b>
                <span>{kindLabel(l.kind, lang)}{l.spec ? ` · ${l.spec}` : ""}</span>
              </div>
              <div className="bom-nums">
                <input className="input bom-qty" type="number" min="0" step="0.1" value={l.qty}
                  aria-label={t3(lang, "cantitate", "quantity", "количество")}
                  onChange={(e) => setLine(i, { qty: +e.target.value || 0 })} />
                <span className="bom-op">×</span>
                <input className="input bom-price" type="number" min="0" step="1" value={l.unit_price}
                  aria-label={t3(lang, "preț unitar", "unit price", "цена за единицу")}
                  onChange={(e) => setLine(i, { unit_price: +e.target.value || 0 })} />
                <b className="bom-total">{money((Number(l.qty) || 0) * (Number(l.unit_price) || 0))}</b>
                <button type="button" className="bom-del" aria-label={t3(lang, "șterge", "remove", "удалить")}
                  onClick={() => onChange(bom.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bom-acts">
        <button type="button" className="btn ghost sm" onClick={() => { setPicking(picking === "supplier" ? null : "supplier"); setQ(""); }}>
          {t3(lang, "+ din catalogul furnizorilor", "+ from the supplier catalog", "+ из каталога поставщиков")}
        </button>
        <button type="button" className="btn ghost sm" disabled={ownRows.length === 0}
          onClick={() => { setPicking(picking === "own" ? null : "own"); setQ(""); }}>
          {ownRows.length
            ? t3(lang, `+ din catalogul meu (${ownRows.length})`, `+ from my catalog (${ownRows.length})`, `+ из моего каталога (${ownRows.length})`)
            : t3(lang, "catalogul meu e gol", "my catalog is empty", "мой каталог пуст")}
        </button>
        <button type="button" className="btn ghost sm" disabled={!(kw > 0)}
          onClick={() => onChange(autoBom(kw, battKwh))}>
          {t3(lang, "⚡ completează automat", "⚡ auto-fill", "⚡ заполнить автоматически")}
        </button>
      </div>

      {picking && (
        <div className="bom-picker">
          <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t3(lang, "caută brand, model sau tip…", "search brand, model or type…", "поиск бренда, модели или типа…")} />
          <div className="bom-pick-list">
            {filtered.map((r) => (
              <button type="button" key={r.key} className="bom-pick" onClick={() => addLine(r)}>
                <span className="bp-main">{r.brand} {r.model}</span>
                <span className="bp-spec">{kindLabel(r.kind, lang)}{r.spec ? ` · ${r.spec}` : ""}</span>
                <span className="bp-meta">{r.meta}</span>
                <b className="bp-price">{money(r.unit_price)}</b>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="bom-empty">{t3(lang, "nicio potrivire", "no matches", "нет совпадений")}</div>
            )}
          </div>
        </div>
      )}

      {bom.length > 0 && (
        <div className="bom-sum">
          <div className="bom-sum-row"><span>{t3(lang, "Materiale", "Materials", "Материалы")}</span><b>{money(materials)}</b></div>
          <div className="bom-sum-row"><span>{t3(lang, "Preț ofertă", "Quote price", "Цена предложения")}</span><b>{money(quotePrice)}</b></div>
          <div className={"bom-sum-row margin" + (margin < 0 ? " neg" : "")}>
            <span>{t3(lang, "Marjă brută", "Gross margin", "Валовая маржа")}</span>
            <b>{money(margin)} <em>{marginPct.toFixed(0)}%</em></b>
          </div>
          {margin < 0 && (
            <div className="bom-warn">
              {t3(lang,
                "Materialele costă mai mult decât prețul din ofertă — manopera și transportul nu sunt încă acoperite.",
                "Materials cost more than the quoted price — labour and transport aren't covered yet.",
                "Материалы дороже цены предложения — работа и доставка ещё не покрыты.")}
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .bom-head{display:flex;align-items:center;gap:10px}
        .bom-lead{font-size:12.5px;color:var(--muted);margin:6px 0 14px;max-width:68ch;line-height:1.55}
        .bom-empty{font-size:12.5px;color:var(--muted);padding:12px;text-align:center;
          background:var(--paper);border:1px dashed var(--line);border-radius:10px}
        .bom-table{display:grid}
        .bom-row{display:grid;gap:6px;padding:10px 0;border-bottom:1px solid var(--line)}
        .bom-row:first-child{padding-top:0}
        .bom-desc b{display:block;font-size:13px;font-weight:600;color:var(--ink);line-height:1.35}
        .bom-desc span{display:block;font-size:11px;color:var(--muted);margin-top:1px}
        .bom-nums{display:flex;align-items:center;gap:7px}
        .bom-row .input{padding:6px 8px;font-size:12.5px;text-align:right;width:62px;flex:none}
        .bom-row .bom-price{width:76px}
        .bom-op{font-size:12px;color:var(--muted)}
        .bom-total{margin-left:auto;font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink)}
        .bom-del{border:0;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:4px;border-radius:6px;flex:none}
        .bom-del:hover{background:var(--red-tint,var(--amber-tint));color:var(--red,#B4472F)}
        .bom-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .bom-picker{margin-top:10px;background:var(--paper);border:1px solid var(--line);border-radius:11px;padding:9px}
        .bom-pick-list{margin-top:8px;max-height:280px;overflow-y:auto;display:grid;gap:3px}
        .bom-pick{display:grid;grid-template-columns:1fr auto;grid-template-areas:"main price" "spec price" "meta price";
          gap:0 10px;text-align:left;border:0;background:none;cursor:pointer;padding:8px 10px;border-radius:8px;width:100%}
        .bom-pick:hover{background:var(--green-tint)}
        .bp-main{grid-area:main;font-size:13px;font-weight:600;color:var(--ink)}
        .bp-spec{grid-area:spec;font-size:11px;color:var(--muted)}
        .bp-meta{grid-area:meta;font-size:10.5px;color:var(--muted);opacity:.85}
        .bp-price{grid-area:price;align-self:center;font-size:13px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
        .bom-sum{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:grid;gap:6px}
        .bom-sum-row{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--muted)}
        .bom-sum-row b{color:var(--ink);font-variant-numeric:tabular-nums}
        .bom-sum-row.margin{font-weight:600}
        .bom-sum-row.margin b{color:var(--green);font-size:16px}
        .bom-sum-row.margin b em{font-style:normal;font-size:11.5px;color:var(--muted);margin-left:5px}
        .bom-sum-row.margin.neg b{color:#B4472F}
        .bom-warn{font-size:12px;line-height:1.5;color:#B4472F;background:var(--amber-tint);border-radius:9px;padding:9px 11px}
      ` }} />
    </section>
  );
}
