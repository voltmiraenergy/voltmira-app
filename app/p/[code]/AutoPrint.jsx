"use client";
// app/p/[code]/AutoPrint.jsx — fires the browser's print (save-as-PDF) dialog
// once the print-mode page has painted. Used only with ?print=1.
import { useEffect } from "react";

export default function AutoPrint() {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 400); // let fonts/layout settle
    return () => clearTimeout(id);
  }, []);
  return null;
}
