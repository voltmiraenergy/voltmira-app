// app/home/login/page.jsx — a homeowner signs in with a link sent to their
// email (docs/MARKETPLACE.md). No password. Romanian unless ?lang= or the
// language cookie says otherwise. Never indexed.
import { cookies } from "next/headers";
import { normLang } from "../../../lib/i18n.js";
import { ht } from "../../../lib/homeText.js";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import Logo from "../../../lib/Logo.jsx";
import HomeLoginForm from "./HomeLoginForm.jsx";
import "../../p/[code]/proposal.css";
import "../home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "VoltMira", robots: { index: false, follow: false, nocache: true } };

export default async function HomeLogin(props) {
  const sp = await props.searchParams;
  let saved;
  try { saved = (await cookies()).get("voltmira_lang")?.value; } catch { /* no cookie */ }
  const lang = normLang(sp?.lang || saved || "ro");
  const T = Object.fromEntries(["hl_email", "hl_send", "hl_sending", "hl_sent", "hl_installer", "hl_error"].map((k) => [k, ht(k, lang)]));
  return (
    <main className="pp hm" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap hm-login">
        <Logo size={30} />
        <h1 className="pp-h2">{ht("hl_title", lang)}</h1>
        <p className="pp-lead">{ht("hl_sub", lang)}</p>
        {sp?.e === "link" && <p className="pp-err" role="alert">{ht("hl_bad_link", lang)}</p>}
        <HomeLoginForm T={T} />
      </div>
    </main>
  );
}
