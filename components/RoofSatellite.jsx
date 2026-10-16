// components/RoofSatellite.jsx — the client's real roof from above, for the
// offer page and its PDF: aerial tiles framed on the roof the installer drew
// (lib/portfolioMap.js fitView, the same static-tile method the plant site
// plan prints with) and, drawn on top, the roof outline, the panels the quote
// sells and any obstacles. One SVG (tiles as <image>), so it scales with the
// page and renders in the PDF, where scripts are blocked. Server-renderable;
// nothing without a roof.
import { fitView } from "../lib/portfolioMap.js";
import { SAT_TILES as SAT } from "../lib/satZoom.js";

/**
 * @param {object} p
 * @param {{ planes: {outline:number[][], panels:number[][][]}[], obstacles?: number[][][] }} p.roof  rings of [lat, lon]
 * @param {number} [p.width]
 * @param {number} [p.height]
 * @param {string} [p.credit]  the imagery credit line
 */
export default function RoofSatellite({ roof, width = 680, height = 380, credit = "Imagery © Esri, Maxar" }) {
  const outlines = (roof?.planes || []).map((pl) => pl.outline).filter((r) => Array.isArray(r) && r.length >= 3);
  if (!outlines.length) return null;
  const pts = outlines.flat().map(([lat, lon]) => ({ lat, lon }));
  // a little of the street around the roof, so the client recognises the house;
  // at most one level past the deepest real imagery here (lib/satZoom.js), as
  // stretching zoom-18 tiles four times over shows only blur
  const tz = [18, 19, 20].includes(roof.tileZoom) ? roof.tileZoom : 18;
  const v = fitView(pts, { width, height, pad: Math.round(Math.min(width, height) * 0.22), maxZoom: tz + 1, maxTileZoom: tz, tiles: { base: SAT, ref: SAT } });
  if (!v) return null;
  const ring = (r) => r.map(([lat, lon]) => v.xy(lat, lon).map((n) => n.toFixed(1)).join(",")).join(" ");
  return (
    <svg className="roof-sat" viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={credit}
      style={{ display: "block", maxWidth: width, borderRadius: 10, background: "#20261F" }} xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="roof-sat-clip"><rect width={width} height={height} rx="10" /></clipPath></defs>
      <g clipPath="url(#roof-sat-clip)">
        {v.tiles.map((t) => (
          <image key={t.key} href={t.src} x={t.left.toFixed(1)} y={t.top.toFixed(1)} width={(t.size + 0.6).toFixed(1)} height={(t.size + 0.6).toFixed(1)} preserveAspectRatio="none" />
        ))}
        {(roof.planes || []).map((pl, i) => (
          <g key={i}>
            <polygon points={ring(pl.outline)} fill="rgba(255,255,255,.10)" stroke="#FFD54A" strokeWidth="2" />
            {(pl.panels || []).map((r, j) => (
              <polygon key={j} points={ring(r)} fill="#1E3A5F" fillOpacity="0.88" stroke="#CFE3FF" strokeWidth="0.6" />
            ))}
          </g>
        ))}
        {(roof.obstacles || []).map((r, j) => (
          <polygon key={j} points={ring(r)} fill="rgba(229,72,77,.35)" stroke="#E5484D" strokeWidth="1.2" strokeDasharray="3 2" />
        ))}
        <text x={width - 8} y={height - 7} textAnchor="end" fontSize="10" fill="#fff" stroke="rgba(0,0,0,.65)" strokeWidth="2.4" paintOrder="stroke" fontFamily="sans-serif">{credit}</text>
      </g>
    </svg>
  );
}
