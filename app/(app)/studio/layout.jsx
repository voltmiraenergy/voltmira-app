// studio/layout.jsx — shell for the Studio section.
//
// Server component: it resolves the workspace language once from the company row
// and hands it down through <StudioLangProvider>, so every surface renders in the
// right language on the FIRST paint — no flash of English while a client-side
// localStorage read resolves. <StudioShell> injects the stylesheet, the
// editable-client provider and the pill nav.
import { currentCompany } from "../../../lib/session.js";
import { normLang } from "../../../lib/i18n.js";
import { StudioLangProvider } from "./studio-kit.jsx";
import StudioShell from "./studio-shell.jsx";

export default async function StudioLayout({ children }) {
  let lang = "en";
  try { lang = normLang((await currentCompany())?.lang); } catch { /* unauthenticated preview — stay English */ }
  return (
    <StudioLangProvider lang={lang}>
      <StudioShell lang={lang}>{children}</StudioShell>
    </StudioLangProvider>
  );
}
