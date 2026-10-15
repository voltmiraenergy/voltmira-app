"use client";
// app/(app)/portfolios/SubmitButton.jsx — a form's submit button that shows it
// is working while the server action runs (a sample looks up the wind and the
// sun for each site, which can take most of a minute), and cannot be pressed
// twice.
import { useFormStatus } from "react-dom";

export default function SubmitButton({ children, className = "btn" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {children}{pending ? "..." : ""}
    </button>
  );
}
