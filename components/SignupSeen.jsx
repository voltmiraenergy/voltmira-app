"use client";
// components/SignupSeen.jsx — tells the server once per browser that this person has opened the app, so their country
// is recorded on their sign-up (app/api/signup-seen). Renders nothing; a failure just means it tries on the next visit.
import { useEffect } from "react";

const KEY = "voltmira_seen";

export default function SignupSeen() {
  useEffect(() => {
    try { if (localStorage.getItem(KEY)) return; } catch { /* storage blocked: asks each visit, the server ignores repeats */ }
    fetch("/api/signup-seen", { method: "POST", credentials: "same-origin" })
      .then((r) => { if (r.ok) try { localStorage.setItem(KEY, "1"); } catch { /* storage blocked */ } })
      .catch(() => {});
  }, []);
  return null;
}
