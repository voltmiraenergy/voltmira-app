"use client";
// app/(app)/projects/[id]/GridFile.jsx — the grid-connection file on a quote.
// Moldova: which operator it goes to (Premier Energy or RED Nord, suggested
// from the address), their own application form filled with this quote's
// details, and the five stages with the day each was done. Ukraine: the
// oblenergo (suggested from the address), what to hand in with the notice,
// and the green-tariff stages (lib/uaGrid.js). When a stage has waited on
// the operator long enough, the card says so, and the dashboard lists it as a
// call to make (lib/dashboardMoves.js). Stored in install_progress.gridFile
// through setGridFile (lib/actions.js).
import "./gridfile.css";
import { useState, useTransition } from "react";
import { Download, Phone, Check, RotateCcw } from "lucide-react";
import { setGridFile } from "../../../../lib/actions.js";
import { t } from "../../../../lib/i18n.js";
import { gridFileStatus } from "../../../../lib/mdGrid.js";
import { gridFor } from "../../../../lib/gridFile.js";
import { mdDayKey } from "../../../../lib/tz.js";

export default function GridFile({ projectId, address, initial, lang, market = "MD" }) {
  const [file, setFile] = useState(() => ({ operator: null, stages: {}, ...(initial || {}) }));
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const grid = gridFor(market) || gridFor("MD");
  const isUA = grid.market === "UA";
  const OPERATORS = grid.operators, GRID_STAGES = grid.stages;
  const op = OPERATORS[file.operator] ? file.operator : grid.suggest(address);
  const opShort = op ? OPERATORS[op].short : t("gf_ua_pick", lang);
  const today = mdDayKey(Date.now());
  const status = gridFileStatus(file, today, GRID_STAGES);
  const dur = (n) => new Intl.NumberFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB", { style: "unit", unit: "day", unitDisplay: "long" }).format(n);

  const save = (patch, optimistic) => {
    const before = file;
    setFile(optimistic);
    setFailed(false);
    start(async () => {
      try {
        const fresh = await setGridFile(projectId, patch);
        if (fresh && typeof fresh === "object") setFile({ operator: null, stages: {}, ...fresh });
      } catch {
        setFile(before);
        setFailed(true);
      }
    });
  };
  const choose = (id) => { if (id !== file.operator) save({ operator: id }, { ...file, operator: id }); };
  const mark = (stage, date) => {
    const stages = { ...file.stages };
    if (date) stages[stage] = date; else delete stages[stage];
    // The first stage marked also keeps the suggested operator, so the
    // dashboard reminder names the same one this card shows.
    const operator = OPERATORS[file.operator] ? file.operator : op;
    save({ ...(operator ? { operator } : {}), stage, date: date || null }, { ...file, operator, stages });
  };

  return (
    <section className="card gf" aria-busy={pending}>
      <div className="gf-head">
        <div>
          <h3>{t("gf_title", lang)}</h3>
          <p>{t("gf_sub", lang, { op: opShort, d: status.done, n: status.total })}</p>
        </div>
        <span className="gf-count">{status.done}/{status.total}</span>
      </div>

      <div className="gf-op">
        <span className="gf-label">{t("gf_operator", lang)}</span>
        {isUA ? (
          // Ukraine: one company per oblast, too many for buttons
          <select className="input gf-select" value={op || ""} aria-label={t("gf_operator", lang)} onChange={(e) => e.target.value && choose(e.target.value)}>
            {!op && <option value="">{t("gf_ua_pick", lang)}</option>}
            {Object.values(OPERATORS).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        ) : (
          <div className="gf-seg" role="radiogroup" aria-label={t("gf_operator", lang)}>
            {Object.values(OPERATORS).map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={op === o.id} className={op === o.id ? "on" : ""} onClick={() => choose(o.id)}>
                {o.short}
              </button>
            ))}
          </div>
        )}
        {!file.operator && op && <p className="gf-hint">{t("gf_suggested", lang)}</p>}
      </div>

      {isUA ? (
        // No single national form in Ukraine: what goes with the notice instead.
        <div className="gf-docs">
          <b>{t("gf_ua_docs_h", lang)}</b>
          <ul>
            <li>{t("gf_ua_doc_certs", lang)}</li>
            <li>{t("gf_ua_doc_sld", lang)}</li>
            <li>{t("gf_ua_doc_owner", lang)}</li>
          </ul>
        </div>
      ) : (
        <a className="gf-dl" href={`/api/projects/${projectId}/racordare-pdf?op=${op}`} target="_blank" rel="noopener noreferrer">
          <Download size={16} aria-hidden="true" />
          <span><b>{t("gf_download", lang)}</b><small>{t("gf_download_h", lang)}</small></span>
        </a>
      )}

      {status.chase && (
        <p className="gf-chase" role="status">
          <Phone size={15} aria-hidden="true" />
          {t("gf_chase", lang, { dur: dur(status.waitingDays), stage: t("gf_stage_" + status.next, lang), op: opShort })}
        </p>
      )}
      {status.complete && <p className="gf-done" role="status"><Check size={15} aria-hidden="true" />{t("gf_complete", lang)}</p>}

      <ol className="gf-steps">
        {GRID_STAGES.map((s, i) => {
          const date = file.stages?.[s.id];
          const isNext = status.next === s.id;
          return (
            <li key={s.id} className={(date ? "done" : "") + (isNext ? " next" : "")}>
              <span className="gf-dot" aria-hidden="true">{date ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
              <span className="gf-tx">
                <b>{t("gf_stage_" + s.id, lang)}</b>
                <small>{t("gf_stage_" + s.id + "_h", lang)}</small>
              </span>
              {date ? (
                <span className="gf-when">
                  <input type="date" value={date} max={today} aria-label={`${t("gf_date", lang)}: ${t("gf_stage_" + s.id, lang)}`}
                    onChange={(e) => e.target.value && mark(s.id, e.target.value)} />
                  <button type="button" className="gf-undo" onClick={() => mark(s.id, null)} aria-label={t("gf_undo", lang)} title={t("gf_undo", lang)}>
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <button type="button" className={"gf-mark" + (isNext ? " primary" : "")} onClick={() => mark(s.id, today)}>
                  {t("gf_mark", lang)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {failed && <p className="gf-err" role="alert">{t("gf_failed", lang)}</p>}
    </section>
  );
}
