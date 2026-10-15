"use client";
// Accordion.jsx — a titled, collapsible block, shared by Equipment (panels,
// inverter, battery) and Monitoring (readings, warranty, tickets) so those
// dense steps don't force every section open at once. Opens by default so
// nothing that used to be visible starts hidden. `aside` is a short summary
// shown on the title row (e.g. the part currently picked).
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Accordion({ title, icon: Icon, aside, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ws-acc">
      <button type="button" className="ws-acc-top" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {Icon && <Icon size={16} aria-hidden="true" />}
        {title}
        <span className="ws-aside">{aside || ""}</span>
        <ChevronDown size={16} className="chev" aria-hidden="true" />
      </button>
      {open && <div className="ws-acc-body">{children}</div>}
    </div>
  );
}
