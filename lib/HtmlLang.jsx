// lib/HtmlLang.jsx — tells the browser the page's real language.
//
// The root layout renders <html lang="en"> for every page, because only it
// can render <html> and it does not know whose page it is. Pages in Romanian
// Russian or Ukrainian (the app, a client's proposal, the widgets) put this near the top
// instead: it sets the attribute while the page is still being read, before
// Chrome decides whether to offer "Translate this page from English" and
// before a screen reader picks its voice. The root <html> has
// suppressHydrationWarning, so React does not object to the change.
export default function HtmlLang({ lang }) {
  const l = ["en", "ro", "ru", "uk"].includes(lang) ? lang : "ro";
  return <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(l)}` }} />;
}
