"use client";
// studio/studio-shell.jsx — the client half of the Studio layout: the design
// tokens + stylesheet, the editable-client provider, the section kicker and the
// numbered pill nav. `lang` comes from the server layout so nothing here flashes.
import { PREVIEW_CSS, PreviewNav, StudioClientProvider, tx } from "./studio-kit.jsx";

export default function StudioShell({ lang, children }) {
  return (
    <StudioClientProvider>
      <div className="pv-wrap">
        {/* AppTheme.jsx already defines the palette, so the bundled TOKENS_CSS
            is not re-injected here. */}
        <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
        <div className="pv-topbar">
          <span className="pv-kicker">{tx({
            en: "Studio · client-ready tools",
            ro: "Studio · instrumente pentru client",
            ru: "Studio · инструменты для клиента",
          }, lang)}</span>
        </div>
        <PreviewNav lang={lang} />
        {children}
      </div>
    </StudioClientProvider>
  );
}
