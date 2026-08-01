"use client";
// app/(app)/catalog/CatalogManager.jsx — manage the equipment library: add / edit
// / delete products, grouped by kind. Local state updates instantly; server
// actions persist. Prices here feed the bill of materials on a quote.
import { useState, useTransition } from "react";
import { addProduct, updateProduct, deleteProduct } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

const KINDS = ["panel", "inverter", "battery", "mounting", "other"];
const KIND_ICON = { panel: "▦", inverter: "⇄", battery: "🔋", mounting: "⛓", other: "◆" };
const SPEC_HINT = { panel: "550 W", inverter: "8 kW", battery: "10 kWh", mounting: "", other: "" };
const EMPTY = { kind: "panel", brand: "", model: "", spec: "", unit_price: "" };

export default function CatalogManager({ initial, lang }) {
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
  function startEdit(p) { setEditId(p.id); setEditForm({ kind: p.kind, brand: p.brand, model: p.model, spec: p.spec, unit_price: p.unit_price }); }
  function saveEdit() {
    start(() => updateProduct(editId, editForm).then(() => {
      setItems(l => l.map(x => x.id === editId ? { ...x, ...editForm, unit_price: Number(editForm.unit_price) || 0 } : x));
      setEditId(null);
    }));
  }
  function remove(id) { setItems(l => l.filter(x => x.id !== id)); start(() => deleteProduct(id)); }

  // shared form fields (add + edit)
  const Fields = ({ v, set }) => (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="field" style={{ width: 120 }}><label>{t("cat_field_kind", lang)}</label>
        <select className="input" value={v.kind} onChange={e => set({ ...v, kind: e.target.value })}>
          {KINDS.map(k => <option key={k} value={k}>{t("cat_kind_" + k, lang)}</option>)}
        </select></div>
      <div className="field" style={{ flex: "1 1 110px" }}><label>{t("cat_field_brand", lang)}</label>
        <input className="input" value={v.brand} maxLength={80} placeholder="Jinko" onChange={e => set({ ...v, brand: e.target.value })} /></div>
      <div className="field" style={{ flex: "1 1 120px" }}><label>{t("cat_field_model", lang)}</label>
        <input className="input" value={v.model} maxLength={80} placeholder="Tiger Neo" onChange={e => set({ ...v, model: e.target.value })} /></div>
      <div className="field" style={{ width: 92 }}><label>{t("cat_field_spec", lang)}</label>
        <input className="input" value={v.spec} maxLength={60} placeholder={SPEC_HINT[v.kind] || "—"} onChange={e => set({ ...v, spec: e.target.value })} /></div>
      <div className="field" style={{ width: 100 }}><label>{t("cat_field_price", lang)}</label>
        <input className="input" type="number" min="0" step="1" value={v.unit_price} placeholder="0"
          onChange={e => set({ ...v, unit_price: e.target.value })} /></div>
    </div>
  );

  const total = items.reduce((s, p) => s + (Number(p.unit_price) || 0), 0);

  return (
    <>
      <div className="page-head">
        <h1>{t("nav_catalog", lang)}</h1>
        <span className="spacer" />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{t("cat_count", lang, { n: items.length })}</span>
        {!adding && <button className="btn primary" onClick={() => { setForm(EMPTY); setAdding(true); }}>+ {t("cat_add", lang)}</button>}
      </div>

      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 16px", maxWidth: "62ch" }}>{t("cat_sub", lang)}</p>

      {adding && (
        <section className="card" style={{ marginBottom: 14, borderColor: "var(--green)" }}>
          <Fields v={form} set={setForm} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn primary" disabled={pending} onClick={saveNew}>{t("cat_save", lang)}</button>
            <button className="btn ghost" disabled={pending} onClick={() => setAdding(false)}>{t("cat_cancel", lang)}</button>
          </div>
        </section>
      )}

      {items.length === 0 && !adding ? (
        <div className="empty" style={{ maxWidth: 460, margin: "48px auto", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden="true">▦</div>
          <b style={{ display: "block", fontSize: 17, marginBottom: 6 }}>{t("cat_empty", lang)}</b>
          <span style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{t("cat_empty_sub", lang)}</span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {KINDS.map(kind => {
            const group = items.filter(p => p.kind === kind);
            if (group.length === 0) return null;
            return (
              <section key={kind}>
                <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", margin: "0 0 10px", display: "flex", gap: 8, alignItems: "center" }}>
                  <span aria-hidden="true">{KIND_ICON[kind]}</span>{t("cat_kind_" + kind, lang)}
                  <span style={{ opacity: .6 }}>· {group.length}</span>
                </h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {group.map(p => editId === p.id ? (
                    <div key={p.id} className="card" style={{ padding: "14px 16px", borderColor: "var(--green)" }}>
                      <Fields v={editForm} set={setEditForm} />
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button className="btn primary" disabled={pending} onClick={saveEdit}>{t("cat_save", lang)}</button>
                        <button className="btn ghost" disabled={pending} onClick={() => setEditId(null)}>{t("cat_cancel", lang)}</button>
                      </div>
                    </div>
                  ) : (
                    <div key={p.id} className="card" style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <b style={{ fontSize: 15 }}>{[p.brand, p.model].filter(Boolean).join(" ") || t("cat_untitled", lang)}</b>
                        {p.spec && <span style={{ marginLeft: 9, fontSize: 12.5, color: "var(--muted)" }}>{p.spec}</span>}
                      </div>
                      <b style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{fmt(p.unit_price)}</b>
                      <button className="btn sm ghost" onClick={() => startEdit(p)} disabled={pending}>{t("cat_edit", lang)}</button>
                      <button className="btn sm ghost" onClick={() => remove(p.id)} disabled={pending}
                        aria-label={t("cat_delete", lang)} title={t("cat_delete", lang)} style={{ color: "var(--muted)" }}>✕</button>
                    </div>
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
