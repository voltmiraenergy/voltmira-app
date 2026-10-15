"use client";
// app/p/[code]/StickyCta.jsx — the bar that keeps the price and "Accept and
// sign" in reach on a phone, where about 80% of clients read the proposal.
// It stays out of the way while the cover's own button is on screen and while
// the accept panel itself is, so there is never a second copy of the button
// in view; it goes for good once the client has signed. Hidden from the side
// summary's width up (proposal.css), where that summary does the same job.
// IntersectionObserver only: no scroll listener.
import { useEffect, useState } from "react";

export default function StickyCta({ label, children }) {
  const [on, setOn] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("pp-hero");
    const accept = document.getElementById("accept");
    if (!hero || !accept || typeof IntersectionObserver === "undefined") return undefined;
    const seen = new Map([[hero, true], [accept, false]]);
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) seen.set(en.target, en.isIntersecting);
      setOn(!seen.get(hero) && !seen.get(accept));
    });
    io.observe(hero);
    io.observe(accept);
    const signed = () => setDone(true);
    window.addEventListener("voltmira:accepted", signed);
    return () => { io.disconnect(); window.removeEventListener("voltmira:accepted", signed); };
  }, []);

  if (done) return null;
  return (
    <div className={"pp-sticky" + (on ? " is-on" : "")} role="region" aria-label={label} inert={!on}>
      {children}
    </div>
  );
}
