"use client";
// components/UpsellModal.jsx — the one place a gated feature explains itself.
// Same overlay/modal shell as LegalDocsModal.jsx so it doesn't introduce a
// second modal visual language. `onUpgrade` is expected to be the same
// upgrade(plan) checkout call Settings already uses.
import { t } from "../lib/i18n.js";

export default function UpsellModal({ lang, plan, onClose, onUpgrade }) {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(420px,100%)" }} onClick={(e) => e.stopPropagation()}>
        <h4>{t("upsell_title", lang, { plan: planName })}</h4>
        <p className="st-desc" style={{ margin: "4px 0 18px" }}>{t("upsell_body", lang, { plan: planName })}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>{t("upsell_close", lang)}</button>
          <button type="button" className="btn amber" onClick={() => onUpgrade?.(plan)}>{t("upsell_cta", lang, { plan: planName })}</button>
        </div>
      </div>
    </div>
  );
}
