"use client";
// app/(app)/dashboard/FirstRun.jsx — what a brand-new workspace sees instead of
// a dashboard full of zeros.
//
// WHY THIS EXISTS. Of the first twelve real accounts, ten never returned after
// the day they signed up, and the activity log shows exactly where they stopped:
//
//   · three created one quote and vanished inside the editor
//   · five clicked "Load sample pipeline" — buried at the bottom of Settings —
//     and that was the last thing they ever did
//   · two did nothing at all
//
// Both live paths were therefore hostile on day one: an empty dashboard offers
// nothing to react to, and the only tool for "show me what this looks like with
// data in it" was hidden in Settings. The one account that came back was the one
// that got a proposal opened by a client.
//
// So this screen offers exactly the two things a first-time installer wants —
// start real work, or see it populated first — and nothing else.
import { useState, useTransition } from "react";
import { seedSampleData } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function FirstRun({ lang, newQuoteAction }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  function loadSample() {
    setBusy(true); setErr(false);
    start(async () => {
      try { await seedSampleData(); }
      catch { setErr(true); setBusy(false); }
    });
  }

  return (
    <section className="firstrun">
      <h2>{t("fr_title", lang)}</h2>
      <p className="fr-sub">{t("fr_sub", lang)}</p>

      <div className="fr-paths">
        {/* Primary: the action that creates value. A form, not a link, so it
            lands the installer straight in a new quote rather than on a list
            with another button to find. */}
        <form action={newQuoteAction} className="fr-card fr-primary">
          <div className="fr-ic" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </div>
          <b>{t("fr_new_t", lang)}</b>
          <span>{t("fr_new_s", lang)}</span>
          <button className="btn primary" type="submit">{t("fr_new_cta", lang)}</button>
        </form>

        {/* Secondary: five people went hunting for this in Settings and left
            when they found it. It belongs on the first screen, not the last. */}
        <div className="fr-card">
          <div className="fr-ic" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>
          </div>
          <b>{t("fr_sample_t", lang)}</b>
          <span>{t("fr_sample_s", lang)}</span>
          <button className="btn ghost" onClick={loadSample} disabled={busy || pending}>
            {busy || pending ? t("fr_sample_busy", lang) : t("fr_sample_cta", lang)}
          </button>
          {err && <span className="fr-err">{t("fr_sample_err", lang)}</span>}
        </div>
      </div>

      <p className="fr-foot">{t("fr_foot", lang)}</p>
    </section>
  );
}
