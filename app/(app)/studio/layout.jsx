// studio/layout.jsx — shell for the Studio section.
//
// Server component: it resolves the workspace language once from the company row
// and hands it down through <StudioLangProvider>, so every surface renders in the
// right language on the FIRST paint — no flash of English while a client-side
// localStorage read resolves. <StudioShell> injects the stylesheet, the
// editable-client provider and the pill nav.
import { currentCompany, currentUser } from "../../../lib/session.js";
import { isDemoEmail } from "../../../lib/demo.js";
import { normLang } from "../../../lib/i18n.js";
import { StudioLangProvider } from "./studio-kit.jsx";
import StudioShell from "./studio-shell.jsx";

export default async function StudioLayout({ children }) {
  let lang = "en";
  try { lang = normLang((await currentCompany())?.lang); } catch { /* unauthenticated preview — stay English */ }
  // the sample clients are the demo's; a real workspace starts with its own blank job
  let demo = false;
  try { demo = isDemoEmail((await currentUser())?.email); } catch { /* signed out */ }
  return (
    <StudioLangProvider lang={lang}>
      <StudioShell lang={lang} demo={demo}>{children}</StudioShell>
    </StudioLangProvider>
  );
}
