// app/manifest.js — Next.js's file convention for /manifest.webmanifest.
// Chiefly for Android/Chrome's own "Add to Home Screen" (iOS Safari still
// keys standalone mode off the apple-mobile-web-app-capable meta tag in
// app/layout.jsx, not this file) — but declaring it properly here costs
// nothing and covers both.
export default function manifest() {
  return {
    name: "VoltMira",
    short_name: "VoltMira",
    description: "Honest three-band payback estimates, tracked proposals, and real PVGIS data for solar installers.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F6F5F0",
    theme_color: "#142A21",
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
