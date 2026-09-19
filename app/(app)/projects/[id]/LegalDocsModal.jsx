"use client";
// app/(app)/projects/[id]/LegalDocsModal.jsx — four documents:
//   "contract"      — a VoltMira-authored service-contract template (editable
//                      text, window.print() export — same pattern as the
//                      proposal PDF and proforma invoice: AutoPrint.jsx /
//                      invoice/PrintNow.jsx).
//   "racordare"      — Premier Energy Distribution's OWN real prosumer
//                      connection-request PDF
//                      (public/legal/cerere-ar-prosumator-premier-energy.pdf),
//                      filled with this project's real data server-side
//                      (lib/racordarePdf.js, served by
//                      app/api/projects/[id]/racordare-pdf/route.js) — not
//                      retyped, not editable here: a real downloaded PDF, MD only.
//   "commissioning"  — "Act de dare în exploatare": a VoltMira-authored
//                      handover/commissioning attestation, same editable-
//                      template status as the contract — real installer
//                      practice, no official government form exists for it.
//   "diagram"        — a real single-line electrical diagram
//                      (components/SingleLineDiagram.jsx), drawn from the
//                      SAME designCheck()/stringInputs() numbers the editor's
//                      own design-check card and BosEstimate already show.
//
// Printing: the old visibility:hidden + position:fixed trick printed the
// SAME page N times (fixed elements repeat on every printed page — the same
// browser behaviour that makes them useful as running headers — and
// visibility:hidden leaves the rest of the app at its full, real layout
// height, so N came from however tall the editor page behind the modal
// happened to be). Fixed instead with a real React portal: the print
// content renders as its own node directly under <body>, and print CSS
// hides every OTHER direct child of body — no positioning trick, no
// repeat, because there's nothing left tall enough to paginate.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buildServiceContract, buildCommissioningAct } from "../../../../lib/legalDocs.js";
import { t } from "../../../../lib/i18n.js";
import SingleLineDiagram from "../../../../components/SingleLineDiagram.jsx";

function PrintPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<div className="ld-print-portal">{children}</div>, document.body);
}

export default function LegalDocsModal({ lang, onClose, company, project }) {
  const isMd = project.market === "MD";
  const [docType, setDocType] = useState("contract"); // "contract" | "racordare" | "commissioning" | "diagram"
  const [contractText, setContractText] = useState(() => buildServiceContract({
    companyLegalName: company.legal_name || company.name, companyRegNo: company.reg_no,
    companyAddress: company.legal_address, companyIban: company.iban,
    clientName: project.clientName, clientAddress: project.address,
    systemKw: project.kw, price: project.price, currency: project.currency || "EUR",
    templateOverride: company.contract_template_override,
  }));
  const [commissioningText, setCommissioningText] = useState(() => buildCommissioningAct({
    companyLegalName: company.legal_name || company.name, companyRegNo: company.reg_no,
    clientName: project.clientName, clientAddress: project.address,
    systemKw: project.kw, hasBattery: !!project.batt, battKwh: project.battKwh,
    warrantyYears: company.install_warranty_years,
    templateOverride: company.commissioning_template_override,
  }));

  const racordareUrl = project.id ? `/api/projects/${project.id}/racordare-pdf` : null;

  const TABS = [
    { id: "contract", label: t("ld_tab_contract", lang), show: true },
    { id: "racordare", label: t("ld_tab_racordare", lang), show: isMd },
    { id: "commissioning", label: t("ld_tab_commissioning", lang), show: true },
    { id: "diagram", label: t("ld_tab_diagram", lang), show: true },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal ld-modal" onClick={(e) => e.stopPropagation()}>
        <h4>{t("ld_title", lang)}</h4>

        <div className="ld-tabs">
          {TABS.filter((tb) => tb.show).map((tb) => (
            <button key={tb.id} type="button" className={"ld-tab" + (docType === tb.id ? " on" : "")}
              onClick={() => setDocType(tb.id)}>{tb.label}</button>
          ))}
        </div>

        {docType === "contract" && (
          <>
            <div className="ld-warn"><b>{t("ld_warn_title", lang)}</b> {t("ld_warn_body", lang)}</div>
            <label className="ld-label">{t("ld_preview_label", lang)}</label>
            <textarea className="ld-textarea" value={contractText} onChange={(e) => setContractText(e.target.value)} spellCheck={false} />
            <div className="ld-foot">
              <button type="button" className="btn ghost" onClick={onClose}>{t("cat_det_close", lang)}</button>
              <button type="button" className="btn primary" onClick={() => window.print()}>{t("ld_export", lang)}</button>
            </div>
          </>
        )}

        {docType === "racordare" && (
          <>
            <div className="ld-warn"><b>{t("ld_warn_title", lang)}</b> {t("ld_racordare_source", lang)}</div>
            <div className="ld-rec-card">
              <div className="ld-rec-row"><span>{t("ld_rec_name", lang)}</span><b>{project.clientName || "—"}</b></div>
              <div className="ld-rec-row"><span>{t("ld_rec_address", lang)}</span><b>{project.address || "—"}</b></div>
              <div className="ld-rec-row"><span>{t("ld_rec_kw", lang)}</span><b>{project.kw ? `${Number(project.kw).toFixed(1)} kW` : "—"}</b></div>
              {project.batt && (
                <div className="ld-rec-row"><span>{t("ld_rec_batt", lang)}</span><b>{project.battKwh ? `${Number(project.battKwh).toFixed(1)} kWh` : "—"}</b></div>
              )}
            </div>
            <p className="ld-rec-note">{t("ld_rec_blank_note", lang)}</p>
            <div className="ld-foot">
              <button type="button" className="btn ghost" onClick={onClose}>{t("cat_det_close", lang)}</button>
              <a className="btn primary" href={racordareUrl || "#"} target="_blank" rel="noopener noreferrer"
                aria-disabled={!racordareUrl} onClick={(e) => { if (!racordareUrl) e.preventDefault(); }}>
                {t("ld_rec_download", lang)}
              </a>
            </div>
          </>
        )}

        {docType === "commissioning" && (
          <>
            <div className="ld-warn"><b>{t("ld_warn_title", lang)}</b> {t("ld_commissioning_note", lang)}</div>
            <label className="ld-label">{t("ld_preview_label", lang)}</label>
            <textarea className="ld-textarea" value={commissioningText} onChange={(e) => setCommissioningText(e.target.value)} spellCheck={false} />
            <div className="ld-foot">
              <button type="button" className="btn ghost" onClick={onClose}>{t("cat_det_close", lang)}</button>
              <button type="button" className="btn primary" onClick={() => window.print()}>{t("ld_export", lang)}</button>
            </div>
          </>
        )}

        {docType === "diagram" && (
          <>
            <div className="ld-warn"><b>{t("ld_warn_title", lang)}</b> {t("ld_diagram_note", lang)}</div>
            <SingleLineDiagram lang={lang} bom={project.bom} kw={project.kw} battKwh={project.battKwh}
              hasBattery={!!project.batt} phases={undefined} market={project.market}
              projectTitle={project.clientName} projectAddress={project.address} />
            <div className="ld-foot">
              <button type="button" className="btn ghost" onClick={onClose}>{t("cat_det_close", lang)}</button>
              <button type="button" className="btn primary" onClick={() => window.print()}>{t("ld_export", lang)}</button>
            </div>
          </>
        )}
      </div>

      {/* Printed exactly once, regardless of what's behind the modal — see
          the file header comment on why this replaced the old
          visibility/position trick. */}
      <PrintPortal>
        {docType === "contract" && <pre className="ld-print-doc">{contractText}</pre>}
        {docType === "commissioning" && <pre className="ld-print-doc">{commissioningText}</pre>}
        {docType === "diagram" && (
          <SingleLineDiagram lang={lang} bom={project.bom} kw={project.kw} battKwh={project.battKwh}
            hasBattery={!!project.batt} phases={undefined} market={project.market}
            projectTitle={project.clientName} projectAddress={project.address} />
        )}
      </PrintPortal>

      <style dangerouslySetInnerHTML={{ __html: `
        .ld-modal{width:min(760px,100%)}
        .ld-tabs{display:flex;gap:2px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:3px;margin:12px 0;flex-wrap:wrap}
        .ld-tab{flex:1;min-width:120px;padding:9px;font-family:inherit;font-size:13px;font-weight:600;color:var(--muted);
          background:none;border:none;border-radius:8px;cursor:pointer;transition:background .14s,color .14s}
        .ld-tab.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(20,42,33,.12)}
        .ld-warn{display:flex;gap:9px;font-size:12.5px;line-height:1.5;color:#7A5A12;background:var(--amber-tint,#FBF0DC);
          border:1px solid #E8C77A;border-radius:10px;padding:11px 13px;margin-bottom:14px}
        .ld-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
          color:var(--muted);margin-bottom:6px}
        .ld-textarea{width:100%;height:340px;padding:14px;border:1px solid var(--line);border-radius:10px;
          font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.55;color:var(--ink);
          background:#fff;resize:vertical;color-scheme:light}
        .ld-rec-card{border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:10px}
        .ld-rec-row{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;font-size:13px;border-bottom:1px solid var(--line)}
        .ld-rec-row:last-child{border-bottom:none}
        .ld-rec-row span{color:var(--muted)}
        .ld-rec-note{font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 16px}
        .ld-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
        .ld-foot a.btn[aria-disabled="true"]{opacity:.5;pointer-events:none}
        .ld-print-portal{display:none}
        .ld-print-doc{white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.55;color:#000;margin:0}
        @media print{
          body > *:not(.ld-print-portal){display:none !important}
          .ld-print-portal{display:block !important;padding:24px}
        }
      ` }} />
    </div>
  );
}
