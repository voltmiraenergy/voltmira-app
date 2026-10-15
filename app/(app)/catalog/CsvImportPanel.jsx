"use client";
// app/(app)/catalog/CsvImportPanel.jsx — bulk-add the installer's own
// products from a CSV spreadsheet, instead of one product at a time through
// CatalogManager's manual form. lib/csvImport.js does the real parsing and
// row-by-row validation (same rules addProduct() enforces for a single
// product, see that file's own comment); this just previews the result and,
// on confirm, hands the valid rows to lib/actions.js's bulkAddProducts().
import { useRef, useState, useTransition } from "react";
import { bulkAddProducts } from "../../../lib/actions.js";
import { parseCsv, normalizeProductRows, productCsvTemplate } from "../../../lib/csvImport.js";
import { t } from "../../../lib/i18n.js";

export default function CsvImportPanel({ lang, onClose, onImported }) {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null); // { valid, results, truncated }
  const [imported, setImported] = useState(null); // count, after a successful import
  const [pending, start] = useTransition();
  const fileInput = useRef(null);

  function downloadTemplate() {
    const blob = new Blob(["﻿" + productCsvTemplate()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "voltmira-catalog-template.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(null);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ""));
      setParsed(normalizeProductRows(rows));
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!parsed?.valid?.length) return;
    start(() => bulkAddProducts(parsed.valid).then((rows) => {
      if (rows?.length) onImported(rows);
      setImported(rows?.length || 0);
      setParsed(null);
      setFileName("");
      if (fileInput.current) fileInput.current.value = "";
    }));
  }

  const okCount = parsed?.valid?.length || 0;
  const badRows = parsed?.results?.filter((r) => !r.ok) || [];

  return (
    <section className="card cat-imp-card">
      <div className="cat-imp-head">
        <h3>{t("cat_imp_title", lang)}</h3>
        <button type="button" className="btn ghost sm" onClick={onClose}>✕</button>
      </div>
      <p className="cat-imp-sub">{t("cat_imp_sub", lang)}</p>

      <div className="cat-imp-actions">
        <button type="button" className="btn ghost" onClick={downloadTemplate}>⇩ {t("cat_imp_template", lang)}</button>
        <label className="btn ghost cat-imp-filebtn">
          ⇧ {t("cat_imp_choose", lang)}
          <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={onFile} hidden />
        </label>
        {fileName && <span className="cat-imp-filename">{t("cat_imp_chosen", lang, { name: fileName })}</span>}
      </div>

      {parsed && (
        <>
          {parsed.results.length === 0 ? (
            <p className="cat-imp-empty">{t("cat_imp_empty", lang)}</p>
          ) : (
            <>
              {parsed.truncated && <p className="cat-imp-warn">{t("cat_imp_toomany", lang)}</p>}
              <p className="cat-imp-preview">
                {t("cat_imp_preview", lang, { ok: okCount, bad: badRows.length })}
              </p>
              {badRows.length > 0 && (
                <table className="cat-imp-table"><tbody>
                  {badRows.slice(0, 30).map((r) => (
                    <tr key={r.rowNum}>
                      <td>{t("cat_imp_col_row", lang)} {r.rowNum}</td>
                      <td>{t(r.error, lang, r.errorArgs || {})}</td>
                    </tr>
                  ))}
                </tbody></table>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" className="btn primary" disabled={pending || okCount === 0} onClick={confirmImport}>
                  {pending ? "…" : t("cat_imp_confirm", lang, { n: okCount })}
                </button>
                <button type="button" className="btn ghost" disabled={pending} onClick={onClose}>{t("cat_imp_close", lang)}</button>
              </div>
            </>
          )}
        </>
      )}

      {imported != null && <p className="cat-imp-success">{t("cat_imp_success", lang, { n: imported })}</p>}

      <style dangerouslySetInnerHTML={{ __html: `
        .cat-imp-card{margin-bottom:16px;border-color:var(--green)}
        .cat-imp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
        .cat-imp-head h3{margin:0;font-size:15px}
        .cat-imp-sub{font-size:12.5px;color:var(--muted);line-height:1.5;margin:0 0 14px;max-width:64ch}
        .cat-imp-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .cat-imp-filebtn{cursor:pointer;display:inline-flex;align-items:center}
        .cat-imp-filename{font-size:12px;color:var(--muted)}
        .cat-imp-empty,.cat-imp-warn{font-size:12.5px;color:#B4472F;margin:14px 0 0}
        .cat-imp-preview{font-size:13px;font-weight:600;color:var(--ink);margin:14px 0 8px}
        .cat-imp-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
        .cat-imp-table td{padding:5px 0;border-bottom:1px solid var(--line);color:var(--muted)}
        .cat-imp-table td:first-child{color:var(--ink);font-weight:600;width:90px}
        .cat-imp-success{font-size:13px;font-weight:600;color:#1E6B4E;margin:14px 0 0}
      ` }} />
    </section>
  );
}
