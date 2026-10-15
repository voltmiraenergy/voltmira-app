"use client";
// components/LinkLabels.jsx — ties each visible label to the control beside it.
//
// Many forms here were written as <div class="field"><label>Name</label><input/></div>:
// the label sits right above the input but is not connected to it, so tapping the
// label does nothing (a real cost on a phone, where the label is the bigger target),
// and a screen reader announces an unnamed field. This links every such pair in
// one place instead of threading an id through each of them. Fields that appear
// later (a toggle that opens more inputs) are picked up by the observer.
import { useEffect } from "react";

let n = 0;

export default function LinkLabels({ root = ".editor" }) {
  useEffect(() => {
    const host = document.querySelector(root);
    if (!host) return undefined;
    const link = () => {
      host.querySelectorAll(".field").forEach((f) => {
        const label = f.querySelector(":scope > label:not([for])");
        const ctl = f.querySelector("input:not([type=hidden]), select, textarea");
        if (!label || !ctl || label.contains(ctl) || ctl.closest("label")) return;
        if (!ctl.id) ctl.id = "lf-" + ++n;
        label.htmlFor = ctl.id;
      });
    };
    link();
    const mo = new MutationObserver(link);
    mo.observe(host, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [root]);
  return null;
}
