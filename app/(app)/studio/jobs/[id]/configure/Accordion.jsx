"use client";
// Accordion.jsx — title + chevron + collapsible body, shared by Equipment
// (panels/inverters/battery) and Monitoring (actuals/warranty+tickets) so
// those two dense tabs don't force every section open at once. Defaults open
// on first render so nothing that used to be always-visible regresses to
// hidden-by-default.
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Accordion({ title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
          {Icon && <Icon className="h-4 w-4 text-slate-400" />} {title}
        </span>
        <ChevronDown className={"h-4 w-4 flex-none text-slate-400 transition-transform " + (open ? "" : "-rotate-90")} />
      </button>
      {open && children}
    </div>
  );
}
