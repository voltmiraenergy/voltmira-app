// app/(legal)/LegalShell.jsx — shared frame for /privacy, /terms, /refunds,
// /cookies and /credits. Same palette, wordmark and type as the homepage
// (Inter Tight for headings, Inter for reading); styles live in legal.css.
import Link from "next/link";

const LINKS = [
  ["/privacy", "Privacy"],
  ["/cookies", "Cookies"],
  ["/terms", "Terms"],
  ["/refunds", "Refunds"],
  ["/credits", "Photo credits"],
];

export default function LegalShell({ title, updated, children }) {
  return (
    <div className="lg">
      <header className="lg-head">
        <div className="lg-wrap lg-head-in">
          <Link href="/" className="lg-logo" aria-label="VoltMira home">
            <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <rect width="34" height="34" rx="8" fill="#142A21" />
              <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
            </svg>
            <span><b>Volt</b><i>Mira</i></span>
          </Link>
          <Link href="/" className="lg-back">Back to site</Link>
        </div>
      </header>

      <main className="lg-wrap lg-main">
        <h1>{title}</h1>
        <p className="lg-updated">Last updated <time>{updated}</time></p>
        <div className="legal-body">{children}</div>
      </main>

      <footer className="lg-foot">
        <nav className="lg-wrap lg-foot-in" aria-label="Legal">
          <span>© 2026 VoltMira</span>
          {LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>
        </nav>
      </footer>
    </div>
  );
}
