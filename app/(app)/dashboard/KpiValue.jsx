"use client";
// app/(app)/dashboard/KpiValue.jsx — counts a KPI number up from 0 on first
// paint. Dashboard is a server component, so this takes the raw number (never
// a function — functions aren't serializable across the server/client
// boundary) plus a `kind` telling it how to format, and does the formatting
// itself on every animation frame.
import { useEffect, useRef, useState } from "react";

function formatValue(kind, n, extra) {
  switch (kind) {
    case "currency":
      return "€" + Math.round(n).toLocaleString("en-IE");
    case "percent":
      return Math.round(n) + "%";
    case "years": {
      const horizon = extra?.horizon ?? 25;
      const suffix = extra?.suffix ?? "yrs";
      return (n >= horizon ? `${horizon}+` : n.toFixed(1)) + " " + suffix;
    }
    case "days":
      return Math.round(n) + " " + (extra?.suffix ?? "days");
    case "count":
    default:
      return Math.round(n).toLocaleString("en-IE");
  }
}

export default function KpiValue({ value, kind = "count", extra, fallback = "—" }) {
  const [display, setDisplay] = useState(value == null ? fallback : formatValue(kind, 0, extra));
  const ran = useRef(false);

  useEffect(() => {
    if (value == null) { setDisplay(fallback); return; }
    if (ran.current) return;
    ran.current = true;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setDisplay(formatValue(kind, value, extra)); return; }

    let start = null;
    const dur = 1100;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(formatValue(kind, value * eased, extra));
      if (p < 1) requestAnimationFrame(step);
      else setDisplay(formatValue(kind, value, extra));
    }
    requestAnimationFrame(step);
    // value/kind/extra are the animation's inputs; ran.current guards against
    // re-running on unrelated re-renders once the count-up has already played.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, kind]);

  return <>{display}</>;
}
