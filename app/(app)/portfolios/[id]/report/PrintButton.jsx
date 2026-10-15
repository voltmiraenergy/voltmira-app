"use client";
// A print button for the on-screen report preview. The PDF the lender gets is
// made on the server (no browser header or URL on it); this is only for a quick
// look and a local print.
export default function PrintButton({ label }) {
  return <button type="button" className="btn ghost" onClick={() => window.print()}>{label}</button>;
}
