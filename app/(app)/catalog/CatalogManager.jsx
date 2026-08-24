"use client";
// app/(app)/catalog/CatalogManager.jsx — the equipment library. A professional,
// image-led catalog: add / edit / delete products grouped by kind, each with a
// real product photo (or a clean kind icon when none is set). Prices here feed
// the bill of materials that drives a quote's real cost.
import { useState, useTransition } from "react";
import { addProduct, updateProduct, deleteProduct, seedStarterCatalog } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

const KINDS = ["panel", "inverter", "battery", "mounting", "other"];
const SPEC_HINT = { panel: "550 W", inverter: "8 kW", battery: "10 kWh", mounting: "", other: "" };
const EMPTY = { kind: "panel", brand: "", model: "", spec: "", unit_price: "", image_url: "", track_stock: false, stock: "" };
const LOW_STOCK = 2;   // available at or below this shows the amber "low" state

// Clean line-art thumbnails per kind — shown when a product has no photo, so the
// grid never has a broken or empty tile. Inherit currentColor for theming.
const KIND_SVG = {
  panel: <><rect x="3" y="4" width="18" height="14" rx="1" /><path d="M3 9h18M3 13.5h18M9 4v14M15 4v14" /><path d="M8 21h8M12 18v3" /></>,
  inverter: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M9 12h6" /><circle cx="12" cy="17" r="1.4" /></>,
  battery: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 3.5h6" /><path d="M13 8l-2.5 4H13l-2 4" /></>,
  mounting: <><path d="M4 7h16M4 12h16M7 7v10M17 7v10" /><path d="M3 20h18" /></>,
  other: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12h8M12 8v8" /></>,
};
function KindGlyph({ kind }) {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {KIND_SVG[kind] || KIND_SVG.other}
    </svg>
  );
}

// Product photo with graceful fallback to the kind glyph if the URL is empty or
// fails to load. Module-level so it keeps stable identity (no remount/flicker).
function ProductThumb({ kind, src, className = "cat-thumb" }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className={className} src={src} alt="" loading="lazy" onError={() => setBroken(true)} />;
  }
  return <div className={`${className} cat-thumb-ph`}><KindGlyph kind={kind} /></div>;
}

const CSS = `
.cat-sub{color:var(--muted);font-size:13.5px;margin:0 0 18px;max-width:64ch}
.cat-form-grid{display:grid;grid-template-columns:130px 1.3fr 1.3fr 110px 120px;gap:10px;align-items:end}
.cat-form-img{display:flex;gap:12px;align-items:flex-end;margin-top:10px}
.cat-form-img .field{flex:1;margin:0}
.cat-form .field{margin:0}
.cat-prev{width:52px;height:52px;border-radius:10px;flex:none;object-fit:cover;border:1px solid var(--line);
  background:var(--paper-2);display:grid;place-items:center;color:var(--muted)}
.cat-group-h{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);
  margin:0 0 12px;display:flex;gap:9px;align-items:center;font-weight:600}
.cat-group-h .n{opacity:.6;font-weight:500}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.cat-card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--paper-2);
  display:flex;flex-direction:column;transition:border-color .18s,box-shadow .18s,transform .18s}
.cat-card:hover{border-color:#CBC7B6;box-shadow:0 10px 26px -14px rgba(20,42,33,.32);transform:translateY(-2px)}
.cat-thumb{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:var(--paper)}
.cat-thumb-ph{width:100%;aspect-ratio:4/3;display:grid;place-items:center;color:var(--muted);
  background:linear-gradient(135deg,var(--paper),var(--green-tint))}
.cat-body{padding:12px 13px 13px;display:flex;flex-direction:column;gap:3px;flex:1}
.cat-name{font-size:14.5px;font-weight:700;line-height:1.25;color:var(--ink)}
.cat-brand{font-size:11.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.cat-spec{display:inline-block;align-self:flex-start;font-size:11.5px;color:var(--ink-soft);
  background:var(--paper);border:1px solid var(--line);border-radius:99px;padding:2px 9px;margin-top:3px}
.cat-foot{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:11px}
.cat-price{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ink);letter-spacing:-.01em}
.cat-price small{font-size:11px;font-weight:500;color:var(--muted);margin-left:3px}
.cat-acts{margin-left:auto;display:flex;gap:5px}
.cat-iconbtn{border:1px solid var(--line);background:var(--paper);border-radius:8px;width:30px;height:30px;
  display:grid;place-items:center;cursor:pointer;color:var(--muted);font-size:13px;transition:color .18s,border-color .18s}
.cat-iconbtn:hover{color:var(--ink);border-color:#CBC7B6}
.cat-starter{border:1.5px dashed var(--line);border-radius:16px;padding:26px 24px;text-align:center;max-width:520px;margin:8px auto}
.cat-inv-row{display:flex;gap:16px;align-items:center;margin-top:12px;flex-wrap:wrap}
.cat-inv-toggle{display:flex;gap:8px;align-items:center;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--ink)}
.cat-inv-toggle input{width:16px;height:16px;accent-color:var(--green);cursor:pointer}
.cat-inv-qty{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted)}
.cat-inv-qty .input{width:96px}
.cat-stock{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;font-size:11.5px;font-weight:700;
  border-radius:99px;padding:3px 10px;margin-top:5px;letter-spacing:.01em}
.cat-stock::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.cat-stock.ok{color:#1E6B4E;background:rgba(30,107,78,.10)}
.cat-stock.low{color:#B26A00;background:rgba(232,155,45,.14)}
.cat-stock.out{color:#B23B2A;background:rgba(196,84,59,.13)}
.cat-stock-sub{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.45}
.cat-starter .em{font-size:34px;margin-bottom:6px}
.cat-starter h3{margin:0 0 6px;font-size:17px}
.cat-starter p{margin:0 auto 16px;color:var(--muted);font-size:13.5px;line-height:1.6;max-width:44ch}
@media(max-width:720px){
  .cat-form-grid{grid-template-columns:1fr 1fr;gap:9px}
  .cat-form-grid .fkind{grid-column:1/-1}
}
`;

export default function CatalogManager({ initial, lang, committed = {}, reserved = {} }) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [pending, start] = useTransition();

  const fmt = (n) => "€" + (Math.round(Number(n) || 0)).toLocaleString("en-IE");

  function saveNew() {
    if (!form.brand.trim() && !form.model.trim()) return;
    start(() => addProduct(form).then(row => {
      if (row) setItems(l => [...l, row]);
      setForm(EMPTY); setAdding(false);
    }));
  }
  function startEdit(p) {
    setEditId(p.id);
    setEditForm({ kind: p.kind, brand: p.brand, model: p.model, spec: p.spec, unit_price: p.unit_price,
      image_url: p.image_url || "", track_stock: !!p.track_stock, stock: p.stock ?? "" });
  }
  function saveEdit() {
    start(() => updateProduct(editId, editForm).then(() => {
      setItems(l => l.map(x => x.id === editId ? { ...x, ...editForm,
        unit_price: Number(editForm.unit_price) || 0,
        track_stock: !!editForm.track_stock, stock: Math.max(0, Math.round(Number(editForm.stock) || 0)) } : x));
      setEditId(null);
    }));
  }
  function remove(id) { setItems(l => l.filter(x => x.id !== id)); start(() => deleteProduct(id)); }
  function loadStarter() {
    start(() => seedStarterCatalog().then(rows => { if (rows?.length) setItems(l => [...l, ...rows]); }));
  }

  // Shared form fields as a CALLED function (not a <Component/>) so the inputs
  // keep a stable identity across renders and never lose focus while typing.
  const fields = (v, set) => (
    <div className="cat-form">
      <div className="cat-form-grid">
        <div className="field fkind"><label>{t("cat_field_kind", lang)}</label>
          <select className="input" value={v.kind} onChange={e => set({ ...v, kind: e.target.value })}>
            {KINDS.map(k => <option key={k} value={k}>{t("cat_kind_" + k, lang)}</option>)}
          </select></div>
        <div className="field"><label>{t("cat_field_brand", lang)}</label>
          <input className="input" value={v.brand} maxLength={80} placeholder="Jinko" onChange={e => set({ ...v, brand: e.target.value })} /></div>
        <div className="field"><label>{t("cat_field_model", lang)}</label>
          <input className="input" value={v.model} maxLength={80} placeholder="Tiger Neo" onChange={e => set({ ...v, model: e.target.value })} /></div>
        <div className="field"><label>{t("cat_field_spec", lang)}</label>
          <input className="input" value={v.spec} maxLength={60} placeholder={SPEC_HINT[v.kind] || "—"} onChange={e => set({ ...v, spec: e.target.value })} /></div>
        <div className="field"><label>{t("cat_field_price", lang)}</label>
          <input className="input" type="number" min="0" step="1" value={v.unit_price} placeholder="0"
            onChange={e => set({ ...v, unit_price: e.target.value })} /></div>
      </div>
      <div className="cat-form-img">
        <div className="field"><label>{t("cat_field_image", lang)}</label>
          <input className="input" value={v.image_url} maxLength={500} placeholder={t("cat_field_image_ph", lang)}
            onChange={e => set({ ...v, image_url: e.target.value })} /></div>
        <ProductThumb kind={v.kind} src={/^https:\/\//i.test(v.image_url || "") ? v.image_url : ""} className="cat-prev" />
      </div>
      <div className="cat-inv-row">
        <label className="cat-inv-toggle">
          <input type="checkbox" checked={!!v.track_stock} onChange={e => set({ ...v, track_stock: e.target.checked })} />
          {t("inv_track", lang)}
        </label>
        {v.track_stock && (
          <div className="cat-inv-qty">
            <span>{t("inv_stock", lang)}</span>
            <input className="input" type="number" min="0" step="1" value={v.stock} placeholder="0"
              onChange={e => set({ ...v, stock: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );

  // Inventory badge for a product card. Available = physical stock minus units
  // committed in WON deals. Open-quote reservations show as a soft hint only.
  function stockBadge(p) {
    if (!p.track_stock) return null;
    const stock = Math.max(0, Math.round(Number(p.stock) || 0));
    const won = committed[p.id] || 0;
    const open = reserved[p.id] || 0;
    const avail = stock - won;
    const cls = avail <= 0 ? "out" : avail <= LOW_STOCK ? "low" : "ok";
    const label = avail <= 0 ? t("inv_out", lang) : t("inv_available", lang, { n: avail });
    const sub = [
      t("inv_on_hand", lang, { n: stock }),
      won > 0 ? t("inv_won", lang, { n: won }) : null,
      open > 0 ? t("inv_open", lang, { n: open }) : null,
    ].filter(Boolean).join(" · ");
    return (
      <>
        <span className={`cat-stock ${cls}`}>{label}</span>
        <span className="cat-stock-sub">{sub}</span>
      </>
    );
  }

  const hasItems = items.length > 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="page-head">
        <h1>{t("nav_catalog", lang)}</h1>
        <span className="spacer" />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{t("cat_count", lang, { n: items.length })}</span>
        {!adding && <button className="btn primary" onClick={() => { setForm(EMPTY); setAdding(true); }}>+ {t("cat_add", lang)}</button>}
      </div>

      <p className="cat-sub">{t("cat_sub", lang)}</p>

      {adding && (
        <section className="card" style={{ marginBottom: 16, borderColor: "var(--green)" }}>
          {fields(form, setForm)}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" disabled={pending} onClick={saveNew}>{t("cat_save", lang)}</button>
            <button className="btn ghost" disabled={pending} onClick={() => setAdding(false)}>{t("cat_cancel", lang)}</button>
          </div>
        </section>
      )}

      {!hasItems && !adding ? (
        <div className="cat-starter">
          
          <h3>{t("cat_empty", lang)}</h3>
          <p>{t("cat_starter_hint", lang)}</p>
          <div style={{ display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn primary" disabled={pending} onClick={loadStarter}>
              {pending ? "…" : "⬇ " + t("cat_load_starter", lang)}
            </button>
            <button className="btn ghost" disabled={pending} onClick={() => { setForm(EMPTY); setAdding(true); }}>+ {t("cat_add", lang)}</button>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 12 }}>{t("cat_starter_note", lang)}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 22 }}>
          {KINDS.map(kind => {
            const group = items.filter(p => p.kind === kind);
            if (group.length === 0) return null;
            return (
              <section key={kind}>
                <h3 className="cat-group-h">
                  <span aria-hidden="true"><KindGlyph kind={kind} /></span>
                  {t("cat_kind_" + kind, lang)}<span className="n">· {group.length}</span>
                </h3>
                {group.some(p => p.id === editId) && (
                  <section className="card" style={{ marginBottom: 12, borderColor: "var(--green)" }}>
                    {fields(editForm, setEditForm)}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button className="btn primary" disabled={pending} onClick={saveEdit}>{t("cat_save", lang)}</button>
                      <button className="btn ghost" disabled={pending} onClick={() => setEditId(null)}>{t("cat_cancel", lang)}</button>
                    </div>
                  </section>
                )}
                <div className="cat-grid">
                  {group.map(p => (
                    <article key={p.id} className="cat-card">
                      <ProductThumb kind={p.kind} src={p.image_url || ""} />
                      <div className="cat-body">
                        {p.brand && <span className="cat-brand">{p.brand}</span>}
                        <span className="cat-name">{p.model || p.brand || t("cat_untitled", lang)}</span>
                        {p.spec && <span className="cat-spec">{p.spec}</span>}
                        {stockBadge(p)}
                        <div className="cat-foot">
                          <span className="cat-price">{fmt(p.unit_price)}<small>{t("cat_price_each", lang)}</small></span>
                          <div className="cat-acts">
                            <button className="cat-iconbtn" onClick={() => startEdit(p)} disabled={pending}
                              aria-label={t("cat_edit", lang)} title={t("cat_edit", lang)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                            <button className="cat-iconbtn" onClick={() => remove(p.id)} disabled={pending}
                              aria-label={t("cat_delete", lang)} title={t("cat_delete", lang)}>✕</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
