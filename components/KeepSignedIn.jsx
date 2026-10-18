"use client";
// components/KeepSignedIn.jsx — while the app is in use, once a day, renew
// this device's sign-in for another 30 days (app/api/auth/keep). Renders
// nothing; a failure only means the renewal waits for tomorrow.
import { useEffect } from "react";

const KEY = "voltmira_keep_at";
const DAY = 24 * 60 * 60 * 1000;

export default function KeepSignedIn() {
  useEffect(() => {
    let last = 0;
    try { last = Number(localStorage.getItem(KEY)) || 0; } catch { /* storage blocked */ }
    if (Date.now() - last < DAY || !navigator.onLine) return;
    fetch("/api/auth/keep", { method: "POST", credentials: "same-origin" })
      .then((r) => { if (r.ok) try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked */ } })
      .catch(() => {});
  }, []);
  return null;
}
