"use client";
// Re-runs the dashboard's server render every minute while the tab is in view,
// so a proposal being read shows up without a reload. Skips hidden tabs: a
// dashboard left open in the background should not keep querying.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ seconds = 60 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    const onShow = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onShow); };
  }, [router, seconds]);
  return null;
}
