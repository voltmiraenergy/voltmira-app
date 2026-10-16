"use client";
// app/(app)/OfflineReady.jsx — turns on offline mode for the signed-in app
// (public/app-sw.js via lib/offline.js) and says so plainly when the device
// has no signal: what still works, and that quote edits wait on the device.
// Demo workspaces register the worker but never pre-save pages, so a stream
// of demo visitors doesn't each fetch a dozen pages in the background.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../lib/i18n.js";
import { registerAppSw, isNetworkError } from "../../lib/offline.js";
import { queuedCount, onQueueChange, flushQueue } from "../../lib/offlineQueue.js";
import { REPLAY_ACTIONS } from "../../lib/offlineReplay.js";

export default function OfflineReady({ lang, demo = false }) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  // ticks made with no signal (lib/offlineQueue.js): counted here, sent when the signal is back
  const waiting = useSyncExternalStore(onQueueChange, queuedCount, () => 0);
  useEffect(() => {
    const send = async () => {
      if (navigator.onLine === false || queuedCount() === 0) return;
      const r = await flushQueue(REPLAY_ACTIONS, isNetworkError);
      if (r.sent) router.refresh();
    };
    send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [router]);
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

  if (!offline && !waiting) return null;
  return (
    <div className="offline-bar" role="status">
      {offline ? t("offline_bar", lang) : null}
      {waiting > 0 && <b className="offline-waiting">{t("offline_waiting", lang, { n: waiting })}</b>}
    </div>
  );
}
