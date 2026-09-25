"use client";
// app/(app)/guide/GuideToc.jsx — the "On this page" list beside the guide.
// Highlights the section being read (IntersectionObserver on the section
// anchors the server added), so a long guide never loses its place.
import { useEffect, useState } from "react";

export default function GuideToc({ items, label }) {
  const [active, setActive] = useState(items[0]?.id || "");

  useEffect(() => {
    const els = items.map((it) => document.getElementById(it.id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null);
      // The first section still on screen, in document order, is the one being read.
      const first = items.find((it) => seen.get(it.id) != null);
      if (first) setActive(first.id);
    }, { rootMargin: "-12% 0px -55% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav className="gx-toc-in" aria-label={label}>
      <p className="gx-toc-h">{label}</p>
      <ol>
        {items.map((it) => (
          <li key={it.id}>
            <a href={"#" + it.id} className={active === it.id ? "on" : ""} aria-current={active === it.id ? "location" : undefined}
              onClick={() => setActive(it.id)}>
              <span className="gx-toc-n" aria-hidden="true">{it.n}</span>{it.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
