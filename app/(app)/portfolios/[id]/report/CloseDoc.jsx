"use client";
// An X on a portfolio's documents (report, bank summary, teaser). In a
// browser they open in their own tab, so X closes it; in the installed app,
// or with the tab reused, it goes back to wherever the person came from, and
// with no history (a link opened straight into it) to the portfolio itself.
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function CloseDoc({ label, href }) {
  const router = useRouter();
  const close = () => {
    if (window.opener && !window.opener.closed) { window.close(); return; }
    if (window.history.length > 1) router.back();
    else router.push(href);
  };
  return (
    <button type="button" className="btn ghost rp-close" onClick={close} aria-label={label} title={label}>
      <X size={18} aria-hidden="true" /><span>{label}</span>
    </button>
  );
}
