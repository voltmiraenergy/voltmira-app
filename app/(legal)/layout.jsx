// app/(legal)/layout.jsx — loads brand fonts + body styling for legal pages.
import "./legal.css";

export const metadata = { robots: { index: true, follow: true } };

export default function LegalLayout({ children }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
