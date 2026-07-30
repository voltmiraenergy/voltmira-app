"use client";
// app/(app)/projects/RowActions.jsx — one-tap row actions so installers can act
// straight from the pipeline table (they work from their phone between site
// visits — a trip into the editor kills follow-through). Open / Copy link /
// Mark won / Duplicate / Delete. Copy-link and Mark-won call server actions.
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProposal, markProjectWon, duplicateProject, deleteProject } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

const IC = {
  open: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  link: <><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.5 5.4" /><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  dup: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  del: <><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></>,
};
const Svg = ({ children, w = 15 }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export default function RowActions({ id, status, lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyLink() {
    if (busy) return;
    setBusy(true);
    try {
      const code = await createProposal(id);           // idempotent: reuses existing link
      await navigator.clipboard?.writeText(`${location.origin}/p/${code}`);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
      router.refresh();                                  // status may have flipped draft→sent
    } finally { setBusy(false); }
  }

  return (
    <div className="row-acts">
      <Link className="btn icon" href={`/projects/${id}`} title={t("ttl_open", lang)} aria-label={t("ttl_open", lang)}><Svg>{IC.open}</Svg></Link>
      <button type="button" className={"btn icon" + (copied ? " ok" : "")} onClick={copyLink} disabled={busy}
        title={copied ? t("t_copied", lang) : t("act_resend", lang)} aria-label={t("act_resend", lang)}>
        {copied ? <Svg>{IC.check}</Svg> : <Svg>{IC.link}</Svg>}
      </button>
      {status !== "won" && (
        <button type="button" className="btn icon win" onClick={() => start(() => markProjectWon(id).then(() => router.refresh()))}
          disabled={pending} title={t("act_mark_won", lang)} aria-label={t("act_mark_won", lang)}><Svg>{IC.check}</Svg></button>
      )}
      <button type="button" className="btn icon" onClick={() => start(() => duplicateProject(id).then(r => r ? router.push(`/projects/${r}`) : router.refresh()))}
        disabled={pending} title={t("ttl_dup", lang)} aria-label={t("ttl_dup", lang)}><Svg>{IC.dup}</Svg></button>
      <button type="button" className="btn icon del" onClick={() => start(() => deleteProject(id).then(() => router.refresh()))}
        disabled={pending} title={t("tm_remove", lang)} aria-label={t("tm_remove", lang)}><Svg>{IC.del}</Svg></button>
    </div>
  );
}
