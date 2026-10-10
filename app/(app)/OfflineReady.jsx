"use client";
// app/(app)/OfflineReady.jsx — turns on offline mode for the signed-in app
// (public/app-sw.js via lib/offline.js) and says so plainly when the device
// has no signal: what still works, and that quote edits wait on the device.
// Demo workspaces register the worker but never pre-save pages, so a stream
// of demo visitors doesn't each fetch a dozen pages in the background.
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n.js";
import { registerAppSw } from "../../lib/offline.js";

export default function OfflineReady({ lang, demo = false }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    registerAppSw({ warm: !demo });
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [demo]);

  if (!offline) return null;
  return <div className="offline-bar" role="status">{t("offline_bar", lang)}</div>;
}
