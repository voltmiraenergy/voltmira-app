"use client";
// components/BackLink.jsx — real back-navigation, not just a fixed destination.
// Standalone (Home Screen) mode has no Safari chrome at all — no swipe-back
// gesture, no back button — so a page reachable only by navigating INTO it
// (a project, an invoice) is a dead end unless something in the page itself
// goes back. router.back() returns to wherever the installer actually came
// from (a filtered list, a specific tab); `href` is only the fallback for
// when this page is the first thing loaded in the session (a fresh deep
// link, or the app was just launched into it).
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BackLink({ href, children, className = "back-link" }) {
  const router = useRouter();
  function onClick(e) {
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
