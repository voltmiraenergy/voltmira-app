"use client";
// studio/layout.jsx — shell for the Studio section. Injects the design tokens +
// the Studio stylesheet, wraps children in the editable-client provider, and
// shows the surface pill row on every page (landing included).
//
// Drop this folder into a Next.js App Router project as `app/studio` (or any
// route segment) and it works. Every surface is a self-contained preview driven
// by the bundled engine (./_engine.js) and mock data — nothing here calls a
// backend.
import { PREVIEW_CSS, PreviewNav, StudioClientProvider, useLang, tx } from "./studio-kit.jsx";

export default function StudioLayout({ children }) {
  const lang = useLang();
  return (
    <StudioClientProvider>
      <div className="pv-wrap">
        {/* AppTheme.jsx already defines the palette, so the bundled TOKENS_CSS
            is dropped to avoid redefining it. */}
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
