"use client";
// app/(app)/projects/[id]/ShareCard.jsx — "Share image on WhatsApp".
// Draws a branded, forwardable image of the quote to a canvas, then shares the
// PNG via the Web Share API (phones) or downloads it and opens WhatsApp with the
// tracked link (desktop). Pure canvas — no external libraries (CSP-safe). A data:
// URL logo draws without tainting the canvas; an external URL logo is skipped so
// toBlob() never fails.
import { useState } from "react";
import { t } from "../../../../lib/i18n.js";

function rr(x, X, Y, W, H, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}

export default function ShareCard({ companyName, companyLogo, client, systemLabel, bands, savings, waText, lang }) {
  const [busy, setBusy] = useState(false);

  const loadLogo = () => new Promise((res) => {
    if (!companyLogo || !/^data:image\//i.test(companyLogo)) return res(null);
    const img = new window.Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = companyLogo;
  });

  async function draw() {
    const W = 1080, H = 1350, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.textBaseline = "alphabetic"; x.textAlign = "left";
    x.fillStyle = "#F6F5F0"; x.fillRect(0, 0, W, H);

    // header
    x.fillStyle = "#142A21"; x.fillRect(0, 0, W, 210);
    const logo = await loadLogo();
    let nameX = 64;
    if (logo) {
      const s = 110, ar = logo.width / logo.height;
      const lw = ar > 1 ? s : s * ar, lh = ar > 1 ? s / ar : s;
      x.drawImage(logo, 64, 50, lw, lh); nameX = 64 + s + 28;
    }
    x.fillStyle = "#fff"; x.font = "700 52px Inter, system-ui, sans-serif";
    x.fillText(companyName || "VoltMira", nameX, 112);
    x.fillStyle = "#E89B2D"; x.font = "600 26px Inter, system-ui, sans-serif";
    x.fillText(t("card_kicker", lang).toUpperCase(), nameX, 156);

    // client + system
    x.fillStyle = "#142A21"; x.font = "700 46px Inter, system-ui, sans-serif";
    x.fillText(client || "—", 64, 330);
    x.fillStyle = "#66756C"; x.font = "400 32px Inter, system-ui, sans-serif";
    x.fillText(systemLabel, 64, 382);

    // payback bands
    const colors = ["#C4543B", "#E89B2D", "#1E6B4E"];
    let by = 500;
    bands.forEach((b, i) => {
      const col = colors[i] || "#1E6B4E";
      x.fillStyle = col; x.beginPath(); x.arc(82, by - 13, 13, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#2B4438"; x.font = "500 36px Inter, system-ui, sans-serif";
      x.fillText(b.label, 116, by);
      x.fillStyle = col; x.font = "700 48px Inter, system-ui, sans-serif";
      x.textAlign = "right"; x.fillText(b.years, W - 64, by); x.textAlign = "left";
      by += 100;
    });

    // savings box
    const bx = 64, bw = W - 128, byy = by + 34, bh = 190;
    x.fillStyle = "#E4EFE9"; rr(x, bx, byy, bw, bh, 26); x.fill();
    x.fillStyle = "#1E6B4E"; x.font = "600 30px Inter, system-ui, sans-serif";
    x.fillText(t("card_savings", lang).toUpperCase(), bx + 42, byy + 66);
    x.font = "800 92px Inter, system-ui, sans-serif";
    x.fillText(savings, bx + 42, byy + 158);

    // footer
    x.fillStyle = "#66756C"; x.font = "500 28px Inter, system-ui, sans-serif";
    x.textAlign = "center"; x.fillText("voltmira.com", W / 2, H - 58); x.textAlign = "left";
    return c;
  }

  async function share() {
    setBusy(true);
    try {
      const canvas = await draw();
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      const file = new File([blob], "voltmira-quote.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: waText });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "voltmira-quote.png"; a.click();
        window.open("https://wa.me/?text=" + encodeURIComponent(waText), "_blank", "noopener");
      }
    } catch { /* share cancelled or unavailable */ }
    finally { setBusy(false); }
  }

  return (
    <button type="button" className="btn wapp" style={{ width: "100%", marginBottom: 10 }} disabled={busy} onClick={share}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.22 8.22 0 0 1-1.26-4.4c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.22 8.24Z" /></svg>
      {busy ? t("card_building", lang) : t("wa_card", lang)}
    </button>
  );
}
