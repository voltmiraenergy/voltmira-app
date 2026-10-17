// lib/inlineScripts.js — the only inline scripts the app itself writes into a
// page, as exact text. The Content-Security-Policy (lib/csp.js) allows each
// one by its SHA-256 hash instead of allowing inline scripts in general
// ('unsafe-inline'), so these strings must be rendered byte for byte as they
// are here: the root layout's theme script and HtmlLang's language script
// both take their text from this file. Change one here and its hash follows.

// Runs before paint to set the theme attribute: prevents a light-then-dark
// flash. Also syncs <meta name="theme-color">, same as the landing page: in
// standalone (Home Screen) mode that color paints the status bar strip itself.
// And marks the installed app on iPhones too old for (display-mode: standalone),
// so its navigation bar (components/AppNavBar.jsx) shows from the first paint.
export const NO_FLASH = `(function(){try{var t=localStorage.getItem("voltmira_theme");if(t!=="dark"&&t!=="light"){t=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";}document.documentElement.setAttribute("data-theme",t);if(window.navigator.standalone===true)document.documentElement.classList.add("is-standalone");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0F1310":"#142A21");}catch(e){}})();`;

export const PAGE_LANGS = ["en", "ro", "ru", "uk"];

const saveScript = (l) => `try{localStorage.setItem('voltmira_lang',${JSON.stringify(l)})}catch(e){}document.cookie='voltmira_lang='+${JSON.stringify(l)}+'; path=/; max-age=31536000; samesite=lax'`;

/** HtmlLang's first-load script: the page's language, and with `persist` the workspace's, kept on the device. */
export function htmlLangScript(lang, persist = false) {
  const l = PAGE_LANGS.includes(lang) ? lang : "ro";
  return `document.documentElement.lang=${JSON.stringify(l)};${persist ? saveScript(l) : ""}`;
}

/** Every inline script the app can render: what the policy hashes. */
export const APP_INLINE_SCRIPTS = [
  NO_FLASH,
  ...PAGE_LANGS.flatMap((l) => [htmlLangScript(l, false), htmlLangScript(l, true)]),
];
