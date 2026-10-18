"use client";
// components/NumInput.jsx — a number field that can be cleared and retyped.
// A controlled <input type="number"> that refuses "" snaps back to the old
// value, so typing a new pitch over "35" gave "354". Here the text is the
// user's while they edit: a number inside the range goes out as they type,
// and leaving the field sends the typed value clamped to the range.
import { useState } from "react";

export default function NumInput({ value, min, max, onValue, onFocus, onBlur, ...rest }) {
  const [draft, setDraft] = useState(null);
  const lo = min == null ? -Infinity : Number(min), hi = max == null ? Infinity : Number(max);
  const valid = (t) => t !== "" && t !== "-" && Number.isFinite(Number(t));
  return (
    <input type="number" {...rest} min={min} max={max} value={draft ?? value ?? ""}
      onFocus={(e) => { setDraft(String(value ?? "")); onFocus?.(e); }}
      onChange={(e) => {
        const t = e.target.value;
        setDraft(t);
        if (valid(t) && Number(t) >= lo && Number(t) <= hi) onValue(Number(t));
      }}
      onBlur={(e) => {
        if (draft != null && valid(draft)) onValue(Math.min(hi, Math.max(lo, Number(draft))));
        setDraft(null);
        onBlur?.(e);
      }} />
  );
}
