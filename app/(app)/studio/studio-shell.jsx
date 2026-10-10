"use client";
// studio/studio-shell.jsx — the client half of the Studio layout: the design
// tokens + stylesheet, the editable-client provider, the section kicker and the
// numbered pill nav. `lang` comes from the server layout so nothing here flashes.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PREVIEW_CSS, PreviewNav, StudioClientProvider, tx } from "./studio-kit.jsx";
import { PREVIEW_BASE } from "./features.js";
import { hydrate } from "./studio-sync.js";

export default function StudioShell({ lang, children }) {
  // The hub carries its own "Studio" header, so the kicker only shows on the tools.
  const onHub = (usePathname() || "") === PREVIEW_BASE;
  // The tools read their data synchronously from the local cache, so the
  // workspace copy has to be in it before any of them mounts.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    hydrate().finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  if (!ready) {
    return (
      <div className="pv-wrap" aria-busy="true">
        <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
        <p className="pv-loading">{tx({ en: "Loading your Studio…", ro: "Se încarcă Studio…", ru: "Загрузка Studio…", uk: "Завантаження Studio…" }, lang)}</p>
      </div>
    );
  }
  return (
    <StudioClientProvider>
      <div className="pv-wrap">
        {/* AppTheme.jsx already defines the palette, so the bundled TOKENS_CSS
            is not re-injected here. */}
        <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
        {!onHub && (
          <div className="pv-topbar">
            <span className="pv-kicker">{tx({
              en: "Studio: client-ready tools",
              ro: "Studio: instrumente pentru client",
              ru: "Studio: инструменты для клиента",
              uk: "Studio: інструменти для клієнта",
            }, lang)}</span>
          </div>
        )}
        <PreviewNav lang={lang} />
        {children}
      </div>
    </StudioClientProvider>
  );
}
