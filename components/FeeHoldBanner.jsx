"use client";
// components/FeeHoldBanner.jsx — the line at the top of every app page while a VoltMira statement is unpaid past its
// date (lib/feeHold.js): what is held (1 the paperwork of its jobs, 2 new offers, 3 every change) and a link to the
// statement. An offer refused for it (lib/sendOffer.js feeHoldAnswer) brings the line into view and says it again.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ft } from "../lib/feeText.js";

export default function FeeHoldBanner({ lang, level = 0, daysLate = 0, month = "", href = "/settings?tab=fees" }) {
  const [shown, setShown] = useState(level);
  const [told, setTold] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const on = (e) => {
      setShown((s) => Math.max(s, Number(e.detail?.hold) || 2));
      setTold(true);
      requestAnimationFrame(() => { ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); ref.current?.focus(); });
    };
    window.addEventListener("vm-fee-hold", on);
    return () => window.removeEventListener("vm-fee-hold", on);
  }, []);
  if (!shown) return null;
  const lvl = Math.min(3, shown);
  return (
    <div ref={ref} tabIndex={-1} className={"fee-hold" + (lvl >= 2 ? " is-held" : "")} role={told ? "alert" : "status"}>
      <p className="fee-hold-tx">
        {told && lvl >= 2 ? ft(lvl >= 3 ? "e_hold_readonly" : "e_hold_offers", lang) : ft(`hold${lvl}_p`, lang, { m: month, n: Math.max(daysLate, lvl >= 3 ? 60 : 30) })}
      </p>
      <Link className="btn amber sm" href={href}>{ft("hold_pay", lang)}</Link>
      <style>{`
        .fee-hold{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px;padding:11px 14px;border-radius:12px;
          background:var(--amber-tint);border:1px solid color-mix(in srgb,var(--amber) 45%,transparent);outline:none}
        .fee-hold.is-held{background:color-mix(in srgb,var(--red) 9%,var(--card));border-color:color-mix(in srgb,var(--red) 40%,transparent)}
        .fee-hold:focus-visible{box-shadow:0 0 0 3px color-mix(in srgb,var(--amber) 40%,transparent)}
        .fee-hold-tx{margin:0;flex:1;min-width:0;font-size:13.5px;line-height:1.45;font-weight:600;color:var(--ink)}
        .fee-hold .btn{flex:none}
        @media (max-width:560px){.fee-hold-tx{flex-basis:100%}}
      `}</style>
    </div>
  );
}
