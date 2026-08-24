"use client";
// app/(app)/projects/TemplateBar.jsx — a VISIBLE row of saved quote templates on
// the Projects page (replaces the old easy-to-miss caret dropdown). Click a chip
// to spin up a pre-filled quote; the × removes the template. Only renders when the
// company has at least one saved template.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectFromTemplate, deleteQuoteTemplate } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function TemplateBar({ templates = [], lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!templates.length) return null;

  const use = (id) =>
    start(() => createProjectFromTemplate(id).then((pid) => pid && router.push(`/projects/${pid}`)));
  const del = (id) => start(() => deleteQuoteTemplate(id));

  return (
    <div className="tpl-bar">
      <style>{`
        .tpl-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:2px 0 18px}
        .tpl-bar-lbl{font-family:var(--font-m,monospace);font-size:11px;letter-spacing:.06em;
          text-transform:uppercase;color:var(--muted);margin-right:2px}
        .tpl-chip{display:inline-flex;align-items:stretch;border:1px solid var(--line);
          border-radius:10px;overflow:hidden;background:var(--paper-2);transition:border-color .2s,transform .2s}
        .tpl-chip:hover{border-color:var(--green);transform:translateY(-1px)}
        .tpl-chip-use{display:flex;flex-direction:column;align-items:flex-start;gap:1px;
          padding:7px 12px;background:none;border:none;cursor:pointer;color:var(--ink);text-align:left}
        .tpl-chip-use b{font-size:13px;font-weight:600;line-height:1.2;max-width:180px;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tpl-chip-use small{font-size:11px;color:var(--muted);font-family:var(--font-m,monospace)}
        .tpl-chip-del{border:none;border-left:1px solid var(--line);background:none;cursor:pointer;
          color:var(--muted);padding:0 10px;font-size:13px;transition:background .2s,color .2s}
        .tpl-chip-del:hover{background:var(--red-tint,#F7E6E1);color:var(--red,#C4543B)}
        .tpl-chip button:disabled{opacity:.5;cursor:default}
      `}</style>
      <span className="tpl-bar-lbl">{t("tpl_from", lang)}</span>
      {templates.map((tp) => (
        <span className="tpl-chip" key={tp.id}>
          <button className="tpl-chip-use" disabled={pending}
            onClick={() => use(tp.id)} title={t("tpl_use_hint", lang)}>
            <b>{tp.name}</b>
            <small>{Number(tp.kw).toFixed(1)} kW · {tp.market}{tp.batt ? " · batt" : ""}</small>
          </button>
          <button className="tpl-chip-del" disabled={pending}
            onClick={() => del(tp.id)} aria-label={t("tpl_delete", lang)} title={t("tpl_delete", lang)}>✕</button>
        </span>
      ))}
    </div>
  );
}
