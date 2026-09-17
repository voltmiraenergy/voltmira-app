"use client";
// app/(app)/projects/[id]/LegalDocsModal.jsx — generates the two most common
// pieces of MD paperwork (service contract, grid-connection request) as
// editable, pre-filled templates — see lib/legalDocs.js for why the document
// text itself stays Romanian-only while this UI shell is normally localized.
// Export is the same window.print() pattern already used for the proposal
// PDF and the proforma invoice (AutoPrint.jsx / invoice/PrintNow.jsx) — no
// second PDF-generation path to keep in sync with those.
import { useState } from "react";
import { buildServiceContract, buildConnectionRequest } from "../../../../lib/legalDocs.js";
import { t } from "../../../../lib/i18n.js";

export default function LegalDocsModal({ lang, onClose, company, project }) {
  const isMd = project.market === "MD";
  const [docType, setDocType] = useState("contract"); // "contract" | "racordare"
  const [contractText, setContractText] = useState(() => buildServiceContract({
    companyLegalName: company.legal_name || company.name, companyRegNo: company.reg_no,
    companyAddress: company.legal_address, companyIban: company.iban,
    clientName: project.clientName, clientAddress: project.address,
    systemKw: project.kw, price: project.price, currency: project.currency || "EUR",
  }));
  const [racordareText, setRacordareText] = useState(() => buildConnectionRequest({
    companyLegalName: company.legal_name || company.name, companyRegNo: company.reg_no,
    clientName: project.clientName, clientAddress: project.address,
    systemKw: project.kw, hasBattery: !!project.batt,
  }));

  const text = docType === "contract" ? contractText : racordareText;
  const setText = docType === "contract" ? setContractText : setRacordareText;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal ld-modal" onClick={(e) => e.stopPropagation()}>
        <h4>{t("ld_title", lang)}</h4>

        <div className="ld-tabs">
          <button type="button" className={"ld-tab" + (docType === "contract" ? " on" : "")}
            onClick={() => setDocType("contract")}>{t("ld_tab_contract", lang)}</button>
          {isMd && (
            <button type="button" className={"ld-tab" + (docType === "racordare" ? " on" : "")}
              onClick={() => setDocType("racordare")}>{t("ld_tab_racordare", lang)}</button>
          )}
        </div>

        <div className="ld-warn">
          <b>{t("ld_warn_title", lang)}</b> {t("ld_warn_body", lang)}
        </div>

        <label className="ld-label">{t("ld_preview_label", lang)}</label>
        <textarea className="ld-textarea" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />

        <div className="ld-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{t("cat_det_close", lang)}</button>
          <button type="button" className="btn primary" onClick={() => window.print()}>
            {t("ld_export", lang)}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ld-modal{width:min(720px,100%)}
        .ld-tabs{display:flex;gap:2px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:3px;margin:12px 0}
        .ld-tab{flex:1;padding:9px;font-family:inherit;font-size:13px;font-weight:600;color:var(--muted);
          background:none;border:none;border-radius:8px;cursor:pointer;transition:background .14s,color .14s}
        .ld-tab.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(20,42,33,.12)}
        .ld-warn{display:flex;gap:9px;font-size:12.5px;line-height:1.5;color:#7A5A12;background:var(--amber-tint,#FBF0DC);
          border:1px solid #E8C77A;border-radius:10px;padding:11px 13px;margin-bottom:14px}
        .ld-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
          color:var(--muted);margin-bottom:6px}
        .ld-textarea{width:100%;height:340px;padding:14px;border:1px solid var(--line);border-radius:10px;
          font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.55;color:var(--ink);
          background:#fff;resize:vertical;color-scheme:light}
        .ld-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
        @media print{
          body *{visibility:hidden}
          .ld-textarea,.ld-textarea *{visibility:visible}
          .ld-textarea{position:fixed;inset:0;width:100%;height:auto;border:none;padding:24px;font-size:12px;resize:none}
        }
      ` }} />
    </div>
  );
}
