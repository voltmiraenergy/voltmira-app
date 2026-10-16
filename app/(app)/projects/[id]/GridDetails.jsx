"use client";
// app/(app)/projects/[id]/GridDetails.jsx — the applicant's details on a
// Moldovan grid file (lib/gridDetails.js): what the operator's form asks for
// that the quote does not hold. Prefilled from the quote, saved once through
// setGridFile into install_progress.gridFile.details, then printed on the
// Premier Energy or RED Nord application. Folded to one line: what is still
// missing and "Fill in", or the applicant and "Edit" once it is complete, so
// the form never takes a phone's whole screen until someone asks for it.
import { useState, useTransition } from "react";
import { UserRound, Pencil } from "lucide-react";
import { setGridFile } from "../../../../lib/actions.js";
import { gridApplicant, gridMissing } from "../../../../lib/gridDetails.js";
import { t } from "../../../../lib/i18n.js";

const LABEL = { name: "gd_name", idn: "gd_idn_bad", phone: "gd_phone", siteAddress: "gd_site", cadastral: "gd_cadastral", email: "gd_email" };

export default function GridDetails({ projectId, client, details, lang, onSaved }) {
  const start0 = gridApplicant(details, client);
  const [d, setD] = useState(start0);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const missing = gridMissing(d);
  const id = (k) => `gd-${k}-${projectId}`;

  function save() {
    setFailed(false);
    start(async () => {
      try {
        const fresh = await setGridFile(projectId, { details: d });
        onSaved?.(fresh);
        if (gridMissing(gridApplicant(fresh?.details, client)).length === 0) setOpen(false);
      } catch { setFailed(true); }
    });
  }

  const field = (k, label, props = {}, hint = null) => (
    <label className="gd-f" htmlFor={id(k)}>
      <span>{t(label, lang)}</span>
      <input id={id(k)} className={"input" + (missing.includes(k) ? " gd-miss" : "")} value={d[k] ?? ""} onChange={set(k)} {...props} />
      {hint && <small>{t(hint, lang)}</small>}
    </label>
  );

  if (!open && missing.length) {
    return (
      <div className="gd-sum warn">
        <UserRound size={16} aria-hidden="true" />
        <span><b>{t("gd_h", lang)}</b><small>{t("gd_missing", lang, { list: missing.map((k) => t(LABEL[k], lang)).join(", ") })}</small></span>
        <button type="button" className="btn primary sm" onClick={() => setOpen(true)}><Pencil size={14} aria-hidden="true" />{t("gd_fill", lang)}</button>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="gd-sum">
        <UserRound size={16} aria-hidden="true" />
        <span><b>{d.name}</b>{d.idn ? `, ${d.idn}` : ""}{d.phone ? `, ${d.phone}` : ""}<small>{t("gd_ok", lang)}</small></span>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}><Pencil size={14} aria-hidden="true" />{t("gd_edit", lang)}</button>
      </div>
    );
  }

  return (
    <div className="gd" role="group" aria-labelledby={id("h")}>
      <div className="gd-head">
        <b id={id("h")}>{t("gd_h", lang)}</b>
        <small>{t("gd_sub", lang)}</small>
      </div>
      <div className="seg2 gd-seg" role="group" aria-label={t("gd_kind", lang)}>
        <button type="button" className={d.kind === "person" ? "on" : ""} aria-pressed={d.kind === "person"} onClick={() => setD((x) => ({ ...x, kind: "person" }))}>{t("gd_person", lang)}</button>
        <button type="button" className={d.kind === "company" ? "on" : ""} aria-pressed={d.kind === "company"} onClick={() => setD((x) => ({ ...x, kind: "company" }))}>{t("gd_company", lang)}</button>
      </div>
      <div className="gd-grid">
        {field("name", "gd_name", { autoComplete: "name", maxLength: 120 })}
        {field("idn", "gd_idn", { inputMode: "numeric", maxLength: 16, placeholder: t("gd_idn_ph", lang) })}
        {field("phone", "gd_phone", { type: "tel", inputMode: "tel", maxLength: 30 })}
        {field("email", "gd_email", { type: "email", maxLength: 120 })}
        {field("siteAddress", "gd_site", { maxLength: 200 })}
        {field("homeAddress", "gd_home", { maxLength: 200 }, "gd_home_h")}
        {field("postcode", "gd_postcode", { inputMode: "numeric", maxLength: 6 })}
        {field("cadastral", "gd_cadastral", { maxLength: 40 })}
        {field("nlc", "gd_nlc", { maxLength: 30 }, "gd_nlc_h")}
        {field("contractedKw", "gd_contracted", { inputMode: "decimal", maxLength: 8 })}
        {field("repName", "gd_rep", { maxLength: 120 })}
        {field("repPhone", "gd_rep_phone", { type: "tel", inputMode: "tel", maxLength: 30 })}
      </div>
      <div className="gd-recv">
        <span>{t("gd_receive", lang)}</span>
        <div className="seg2 gd-seg" role="group" aria-label={t("gd_receive", lang)}>
          <button type="button" className={d.receive === "email" ? "on" : ""} aria-pressed={d.receive === "email"} onClick={() => setD((x) => ({ ...x, receive: "email" }))}>{t("gd_by_email", lang)}</button>
          <button type="button" className={d.receive === "office" ? "on" : ""} aria-pressed={d.receive === "office"} onClick={() => setD((x) => ({ ...x, receive: "office" }))}>{t("gd_at_office", lang)}</button>
        </div>
      </div>
      <p className={"gd-state" + (missing.length ? " warn" : "")} role="status">
        {missing.length ? t("gd_missing", lang, { list: missing.map((k) => t(LABEL[k], lang)).join(", ") }) : t("gd_ok", lang)}
      </p>
      <div className="gd-acts">
        <button type="button" className="btn primary sm" disabled={pending} onClick={save}>{pending ? t("gd_saving", lang) : t("gd_save", lang)}</button>
      </div>
      {failed && <p className="gf-err" role="alert">{t("gf_failed", lang)}</p>}
    </div>
  );
}
