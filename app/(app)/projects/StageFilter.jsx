"use client";
// app/(app)/projects/StageFilter.jsx — "show me the quotes at this stage" on
// the Quotes list. The page builds every option's URL on the server (keeping
// the other filters), so this only navigates; it works with any filter combo
// and the choice stays in the query string like the rest of the list's view.
import { useRouter } from "next/navigation";

export default function StageFilter({ label, value, options }) {
  const router = useRouter();
  return (
    <label className="q-stage">
      <span className="sr">{label}</span>
      <select className="q-stage-sel" value={value} aria-label={label}
        onChange={(e) => { const o = options.find((x) => x.value === e.target.value); if (o) router.push(o.href); }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}{o.n != null ? ` (${o.n})` : ""}</option>
        ))}
      </select>
    </label>
  );
}
