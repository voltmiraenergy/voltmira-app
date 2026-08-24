"use client";
// Fires the browser save-as-PDF dialog once the invoice has painted.
import { useEffect } from "react";
export default function PrintNow() {
  useEffect(() => { const id = setTimeout(() => window.print(), 450); return () => clearTimeout(id); }, []);
  return null;
}
