// components/RoofPhotoPlan.jsx — the installer's own photo of the roof (a drone shot is best) with, drawn on top,
// the roof outline, the panels the quote sells and any obstacles, for the offer page and its PDF. The photo's
// place on the ground (lib/photoPlace.js) is what the installer set in the roof designer, so each corner and
// panel falls where it was drawn on the map. One SVG, so it scales with the page and renders in the PDF.
// Server-renderable; nothing without a roof.
import { projectToPhoto } from "../lib/photoPlace.js";

/**
 * @param {object} p
 * @param {string} p.photo  the photo's https address
 * @param {{lat:number, lon:number, widthM:number, rotDeg:number, aspect:number}} p.place
 * @param {{ planes: {outline:number[][], panels:number[][][]}[], obstacles?: number[][][] }} p.roof  rings of [lat, lon]
 * @param {number} [p.width]
 */
export default function RoofPhotoPlan({ photo, place, roof, width = 680 }) {
  const planes = (roof?.planes || []).filter((pl) => Array.isArray(pl.outline) && pl.outline.length >= 3);
  if (!photo || !place || !planes.length) return null;
  const height = width / place.aspect;
  const ring = (r) => r.map(([lat, lon]) => {
    const { x, y } = projectToPhoto(place, lat, lon);
    return `${(x * width).toFixed(1)},${(y * height).toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="roof-photo-plan" viewBox={`0 0 ${width} ${height.toFixed(1)}`} width="100%" role="img"
      style={{ display: "block", maxWidth: width, height: "auto", borderRadius: 10, background: "#20261F" }} xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="roof-photo-clip"><rect width={width} height={height} rx="10" /></clipPath></defs>
      <g clipPath="url(#roof-photo-clip)">
        <image href={photo} x="0" y="0" width={width} height={height} preserveAspectRatio="none" />
        {planes.map((pl, i) => (
          <g key={i}>
            <polygon points={ring(pl.outline)} fill="rgba(255,255,255,.08)" stroke="#FFD54A" strokeWidth="2" />
            {(pl.panels || []).map((r, j) => (
              <polygon key={j} points={ring(r)} fill="#1E3A5F" fillOpacity="0.82" stroke="#CFE3FF" strokeWidth="0.6" />
            ))}
          </g>
        ))}
        {(roof.obstacles || []).map((r, j) => (
          <polygon key={j} points={ring(r)} fill="rgba(229,72,77,.35)" stroke="#E5484D" strokeWidth="1.2" strokeDasharray="3 2" />
        ))}
      </g>
    </svg>
  );
}
