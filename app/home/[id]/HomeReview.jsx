"use client";
// app/home/[id]/HomeReview.jsx — the homeowner rates the installer, once the
// system is commissioned; one rating per system (/api/home/review).
import { useId, useState } from "react";

export default function HomeReview({ projectId, T, may, existing }) {
  const id = useId();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [done, setDone] = useState(existing);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fill = (s, n) => s.split("{n}").join(String(n));

  if (!may.ok && may.reason !== "already" && !done) {
    return <section className="pp-card hm-card hm-wide"><h2 className="pp-h3">{T.hm_rv_h}</h2><p className="hm-muted">{T.hm_rv_wait}</p></section>;
  }

  async function send(e) {
    e.preventDefault();
    if (busy || !rating) return;
    setBusy(true); setFailed(false);
    const res = await fetch("/api/home/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, rating, body }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) setDone(rating); else setFailed(true);
  }

  return (
    <section className="pp-card hm-card hm-wide" aria-labelledby={`${id}-h`}>
      <h2 className="pp-h3" id={`${id}-h`}>{T.hm_rv_h}</h2>
      {done ? <p className="pp-ok-msg" role="status">{fill(T.hm_rv_done, done)}</p> : (
        <form className="hm-form" onSubmit={send}>
          <p className="hm-muted">{T.hm_rv_p}</p>
          <div className="hm-stars" role="radiogroup" aria-label={T.hm_rv_h}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={fill(T.hm_rv_stars, n)}
                className={"hm-star" + (n <= rating ? " on" : "")} onClick={() => setRating(n)}>{n}</button>
            ))}
          </div>
          <label className="pp-field-l" htmlFor={`${id}-b`}>{T.hm_rv_body}</label>
          <textarea id={`${id}-b`} className="pp-input" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="submit" className="pp-btn pp-btn-accept" disabled={busy || !rating}>{T.hm_rv_send}</button>
          {failed && <p className="pp-err" role="alert">{T.hm_failed}</p>}
        </form>
      )}
    </section>
  );
}
