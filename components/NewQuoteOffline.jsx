"use client";
// components/NewQuoteOffline.jsx — "New quote" that still works with no
// signal: online it submits the server action as before; offline it starts a
// draft on the device (lib/offlineDrafts.js) and opens the draft page, which
// the offline worker keeps. For the dashboard's form button.
import { startDraft } from "../lib/offlineDrafts.js";

export function offlineDraftGo(lang) {
  const id = startDraft(lang);
  // a full load on purpose: with no network the worker answers from its saved
  // copy, where a client-side navigation would try the server and fail
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/projects/draft?id=${id}`);
}

export default function NewQuoteOffline({ action, lang, className, children }) {
  return (
    <form action={action} onSubmit={(e) => { if (navigator.onLine === false) { e.preventDefault(); offlineDraftGo(lang); } }}>
      <button className={className} type="submit">{children}</button>
    </form>
  );
}
