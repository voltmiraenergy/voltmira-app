"use client";
// app/(app)/projects/BulkBar.jsx — the "act on selected quotes" bar. It is hidden
// by CSS until at least one row is ticked (`.bulk-form:has(input.bulk-id:checked)`),
// so it reads as a bulk editor, never as a filter that does nothing. This component
// only tracks the selection to show a live count, drive the header select-all, and
// confirm bulk delete. The status/delete buttons submit the parent server form.
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n.js";

export default function BulkBar({ lang }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const rows = () => document.querySelectorAll("input.bulk-id");
    function sync() {
      const n = document.querySelectorAll("input.bulk-id:checked").length;
      setCount(n);
      const sa = document.querySelector("input.sel-all");
      if (sa) { const total = rows().length; sa.checked = n > 0 && n === total; sa.indeterminate = n > 0 && n < total; }
    }
    function onChange(e) {
      const el = e.target;
      if (!el || !el.matches) return;
      if (el.matches("input.sel-all")) rows().forEach(b => { b.checked = el.checked; });
      if (el.matches("input.bulk-id") || el.matches("input.sel-all")) sync();
    }
    // Delegated on document so it survives the table's soft-navigation DOM swaps
    // (filter / sort / page changes re-render the rows).
    document.addEventListener("change", onChange);
    sync();
    return () => document.removeEventListener("change", onChange);
  }, []);

  function clear() {
    document.querySelectorAll("input.bulk-id, input.sel-all").forEach(b => { b.checked = false; b.indeterminate = false; });
    setCount(0);
  }
  const confirmDelete = (e) => { if (!confirm(t("bulk_del_confirm", lang))) e.preventDefault(); };

  return (
    <div className="bulkbar" aria-live="polite">
      <span className="bb-lbl">{t("bulk_selected", lang, { n: count })}</span>
      <button className="chip won" name="op" value="won" type="submit">{t("st_won", lang)}</button>
      <button className="chip lost" name="op" value="lost" type="submit">{t("st_lost", lang)}</button>
      <button className="chip sent" name="op" value="sent" type="submit">{t("st_sent", lang)}</button>
      <button className="chip draft" name="op" value="draft" type="submit">{t("st_draft", lang)}</button>
      <button type="button" className="bb-clear" onClick={clear}>{t("bulk_clear", lang)}</button>
      <span className="spacer" />
      <button className="btn sm danger" name="op" value="delete" type="submit" onClick={confirmDelete}>{t("bulk_delete", lang)}</button>
    </div>
  );
}
