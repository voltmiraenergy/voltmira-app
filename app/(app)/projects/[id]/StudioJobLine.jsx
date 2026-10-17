"use client";
// app/(app)/projects/[id]/StudioJobLine.jsx — on a quote linked to a Studio
// job (lib/studioLink.js): one line naming the job, with a way to open it.
// Nothing when no job points at this quote.
import { useEffect, useState } from "react";
import Link from "next/link";
import { studioJobFor } from "../../../../lib/studioLink.js";
import { t } from "../../../../lib/i18n.js";

export default function StudioJobLine({ projectId, kw, lang }) {
  const [job, setJob] = useState(null);
  useEffect(() => {
    let alive = true;
    studioJobFor(projectId).then((j) => { if (alive) setJob(j); }).catch(() => {});
    return () => { alive = false; };
  }, [projectId]);
  if (!job) return null;
  const differs = Math.abs(job.kw - (Number(kw) || 0)) > 0.05;
  return (
    <section className="card sj-line">
      <span><b>{t("sj_h", lang)}</b> {job.name || t("sj_unnamed", lang)}{differs ? <small>{t("sj_differs", lang, { j: job.kw.toFixed(1) })}</small> : null}</span>
      <Link className="btn ghost sm" href={`/studio/jobs/${encodeURIComponent(job.id)}`}>{t("sj_open", lang)}</Link>
    </section>
  );
}
