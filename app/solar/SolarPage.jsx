// app/solar/SolarPage.jsx — the public "get a solar design" funnel
// (docs/MARKETPLACE.md), one page in four languages at /solar, /ro/solar,
// /ru/solar and /uk/solar. Server-rendered words around the interactive form
// (FunnelForm.jsx): the address and the consumption, an instant estimate
// priced with today's tariff rule, then a request for offers to verified
// installers. Indexed on voltmira.com (proxy.js PUBLIC_PAGES).
import { ht, HT } from "../../lib/homeText.js";
import { aiOn } from "../../lib/featureFlags.js";
import HtmlLang from "../../lib/HtmlLang.jsx";
import Logo from "../../lib/Logo.jsx";
import FunnelForm from "./FunnelForm.jsx";
import "../p/[code]/proposal.css";
import "./funnel.css";

const PATH = { en: "/solar", ro: "/ro/solar", ru: "/ru/solar", uk: "/uk/solar" };
const SITE = "https://voltmira.com";

export function solarMetadata(lang) {
  return {
    title: ht("fn_meta_title", lang),
    description: ht("fn_meta_desc", lang),
    alternates: { canonical: SITE + PATH[lang], languages: { en: SITE + PATH.en, ro: SITE + PATH.ro, ru: SITE + PATH.ru, uk: SITE + PATH.uk, "x-default": SITE + PATH.ro } },
    openGraph: { title: ht("fn_meta_title", lang), description: ht("fn_meta_desc", lang), url: SITE + PATH[lang], siteName: "VoltMira", type: "website" },
  };
}

export default function SolarPage({ lang }) {
  const keys = Object.keys(HT).filter((k) => k.startsWith("fn_"));
  const T = Object.fromEntries(keys.map((k) => [k, ht(k, lang)]));
  return (
    <main className="pp sf" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap sf-wrap">
        <header className="sf-top">
          <a href={lang === "en" ? "/" : `/${lang}`} aria-label="VoltMira"><Logo size={30} /></a>
          <nav className="sf-langs" aria-label="Language">
            {["ro", "ru", "uk", "en"].map((l) => <a key={l} href={PATH[l]} hrefLang={l} aria-current={l === lang ? "page" : undefined}>{l.toUpperCase()}</a>)}
          </nav>
        </header>

        <section className="sf-hero">
          <p className="sf-kicker">{ht("fn_kicker", lang)}</p>
          <h1 className="sf-h1">{ht("fn_h1", lang)}</h1>
          <p className="pp-lead sf-lead">{ht("fn_lead", lang)}</p>
        </section>

        <FunnelForm lang={lang} T={T} photo={aiOn()} privacyHref={lang === "en" ? "/privacy" : `/privacy?lang=${lang}`} />

        <section className="sf-how" aria-labelledby="sf-how-h">
          <h2 className="pp-h3" id="sf-how-h">{ht("fn_how_h", lang)}</h2>
          <ol className="sf-steps">
            <li>{ht("fn_how_1", lang)}</li>
            <li>{ht("fn_how_2", lang)}</li>
            <li>{ht("fn_how_3", lang)}</li>
          </ol>
          <h2 className="pp-h3">{ht("fn_verified_h", lang)}</h2>
          <p className="sf-p">{ht("fn_verified_p", lang)}</p>
        </section>
      </div>
    </main>
  );
}
