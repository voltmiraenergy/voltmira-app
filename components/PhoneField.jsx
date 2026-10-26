"use client";
// components/PhoneField.jsx — a phone number with its country: the code on a button ("MD +373"), and a list under it
// to find another by typing its name or its code ("+40", "Româ"). A number pasted with its code ("+40 721 ...") picks
// the country by itself. The list opens in place, not over the page, so it is never cut off. Optional: an empty
// number is fine. The parent gets the number as stored ("+37369123456", or "" when empty, or null when invalid).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DIAL, searchDial, countryLabel, defaultIso, splitIntl, toE164 } from "../lib/dialCodes.js";

const T = {
  en: { search: "Country or code, e.g. Moldova or +373", none: "No country found", change: "Change country", optional: "optional" },
  ro: { search: "Țara sau prefixul, de ex. Moldova sau +373", none: "Nicio țară găsită", change: "Schimbă țara", optional: "opțional" },
  ru: { search: "Страна или код, например Молдова или +373", none: "Страна не найдена", change: "Сменить страну", optional: "необязательно" },
  uk: { search: "Країна або код, наприклад Молдова чи +373", none: "Країну не знайдено", change: "Змінити країну", optional: "необов’язково" },
};

export default function PhoneField({ lang = "ro", label, placeholder, onChange, disabled = false, tabIndex }) {
  const t = T[lang] || T.ro;
  const uid = useId();
  const [iso, setIso] = useState(defaultIso(lang));
  const [num, setNum] = useState("");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const searchRef = useRef(null);
  const numRef = useRef(null);
  const code = (DIAL.find(([i]) => i === iso) || DIAL[0])[1];
  const list = useMemo(() => searchDial(q, lang), [q, lang]);

  useEffect(() => { onChange?.(toE164(iso, num)); }, [iso, num]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);

  function pick(i) {
    setIso(i); setOpen(false); setQ(""); setHi(0);
    requestAnimationFrame(() => numRef.current?.focus());
  }
  function typed(v) {
    // pasted or typed with its code: the country follows
    const s = splitIntl(v);
    if (s) { setIso(s.iso); setNum(s.national); return; }
    // a code being typed key by key ("+3", "+37") keeps its "+" until it names a country
    setNum(v.replace(/[^\d\s()+-]/g, "").replace(/(?!^)\+/g, "").replace(/^\s+/, ""));
  }
  function keys(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[hi]) pick(list[hi][0]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); setQ(""); }
  }

  return (
    <div className="field pf">
      <label htmlFor={uid + "-n"}>{label} <span className="pf-opt">({t.optional})</span></label>
      <div className={"pf-row" + (open ? " is-open" : "")}>
        <button type="button" className="pf-cc" aria-haspopup="listbox" aria-expanded={open} aria-controls={uid + "-l"}
          aria-label={`${t.change}: ${countryLabel(iso, lang)} +${code}`} disabled={disabled} tabIndex={tabIndex}
          onClick={() => setOpen((o) => !o)}>
          <b>{iso}</b><span>+{code}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <input id={uid + "-n"} ref={numRef} type="tel" inputMode="tel" autoComplete="tel-national" placeholder={placeholder}
          value={num} onChange={(e) => typed(e.target.value)} disabled={disabled} tabIndex={tabIndex} />
      </div>
      {open && (
        <div className="pf-pop">
          <input ref={searchRef} type="search" className="pf-search" placeholder={t.search} value={q} aria-label={t.search}
            aria-controls={uid + "-l"} aria-activedescendant={list[hi] ? `${uid}-o-${list[hi][0]}` : undefined}
            onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={keys} />
          <ul id={uid + "-l"} role="listbox" className="pf-list" aria-label={t.change}>
            {list.map(([i, c], k) => (
              <li key={i} id={`${uid}-o-${i}`} role="option" aria-selected={i === iso}
                className={(k === hi ? "hi " : "") + (i === iso ? "on" : "")}
                onMouseEnter={() => setHi(k)} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
                <span className="pf-iso">{i}</span><span className="pf-name">{countryLabel(i, lang)}</span><span className="pf-code">+{c}</span>
              </li>
            ))}
            {!list.length && <li className="pf-none" role="presentation">{t.none}</li>}
          </ul>
        </div>
      )}
      <style>{`
        .pf-opt{font-weight:500;letter-spacing:0;text-transform:none;opacity:.8}
        .pf-row{display:flex;height:50px;border:1.5px solid var(--line-2);border-radius:12px;background:var(--paper);overflow:hidden;transition:border-color .2s,box-shadow .2s,background-color .2s}
        .pf-row:hover{border-color:var(--muted)}
        .pf-row:focus-within,.pf-row.is-open{border-color:var(--green);background:var(--paper-2);box-shadow:0 0 0 4px var(--green-tint)}
        .pf-cc{display:flex;align-items:center;gap:6px;flex:none;padding:0 12px 0 14px;border:0;border-right:1.5px solid var(--line);background:transparent;color:var(--ink);font:500 15px var(--f-b);cursor:pointer}
        .pf-cc b{font-size:11.5px;font-weight:700;letter-spacing:.06em;padding:3px 6px;border-radius:6px;background:var(--paper-3);color:var(--ink-2)}
        .pf-cc span{font-variant-numeric:tabular-nums}
        .pf-cc svg{color:var(--muted);transition:transform .2s}
        .pf-row.is-open .pf-cc svg{transform:rotate(180deg)}
        .pf-cc:focus-visible{outline:none;background:var(--paper-3)}
        .field .pf-row input{flex:1;min-width:0;height:100%;border:0;border-radius:0;background:transparent;box-shadow:none;padding:0 14px}
        .field .pf-row input:focus{box-shadow:none;background:transparent}
        .pf-pop{margin:8px 0 4px;border:1.5px solid var(--line-2);border-radius:12px;background:var(--paper-2);overflow:hidden}
        .field .pf-pop .pf-search{height:44px;border:0;border-bottom:1px solid var(--line);border-radius:0;background:var(--paper);box-shadow:none;font-size:14.5px}
        .pf-list{list-style:none;margin:0;padding:4px;max-height:232px;overflow-y:auto}
        .pf-list li{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;cursor:pointer;font-size:14.5px;color:var(--ink)}
        .pf-list li.hi{background:var(--paper-3)}
        .pf-list li.on .pf-name{font-weight:700}
        .pf-iso{flex:none;width:30px;font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--muted)}
        .pf-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pf-code{flex:none;font-variant-numeric:tabular-nums;color:var(--muted);font-weight:600}
        .pf-none{color:var(--muted);cursor:default}
      `}</style>
    </div>
  );
}
