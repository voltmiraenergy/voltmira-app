// app/(legal)/layout.jsx — loads brand fonts + body styling for legal pages.
// Each page sets its own title, description and canonical; the root layout's
// metadataBase turns "/privacy" into https://voltmira.com/privacy.
import "./legal.css";

export const metadata = {
  robots: { index: true, follow: true },
  openGraph: { siteName: "VoltMira", type: "article", images: ["/og.png"] },
};

export default function LegalLayout({ children }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@700;800&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
