"use client";
// app/p/[code]/AcceptLink.jsx — every "Accept and sign" on the page that is
// not the real button (the cover, the side summary, the phone bar). A plain
// link to #accept, so it works before the page's script has loaded; with the
// script it also opens the signing panel (tracker.jsx listens for
// "voltmira:sign"), scrolls there and moves focus to the section's heading.
// Once the client has signed (on load, or "voltmira:accepted" from the
// tracker) it reads "Accepted and signed" and only scrolls.
import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";

export default function AcceptLink({ label, doneLabel, accepted: initial = false, className = "" }) {
  const [accepted, setAccepted] = useState(initial);
  useEffect(() => {
    const on = () => setAccepted(true);
    window.addEventListener("voltmira:accepted", on);
    return () => window.removeEventListener("voltmira:accepted", on);
  }, []);

  function go(e) {
    const target = document.getElementById("accept");
    if (!target) return;
    e.preventDefault();
    if (!accepted) window.dispatchEvent(new CustomEvent("voltmira:sign"));
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    target.querySelector("h2")?.focus({ preventScroll: true });
  }

  return (
    <a href="#accept" onClick={go} className={className + (accepted ? " is-done" : "")}>
      {accepted && <PenLine className="pp-ic" aria-hidden="true" />}
      {accepted ? doneLabel : label}
    </a>
  );
}
