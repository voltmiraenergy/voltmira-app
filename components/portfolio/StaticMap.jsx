// components/portfolio/StaticMap.jsx — the asset map for the PDF report and
// the teaser, where scripts are blocked: plain positioned tile images and
// numbered markers (lib/portfolioMap.js does the projection). Each number
// matches the asset's row in the table and the list beside it.
// Server-renderable.
//
// No two markers overlap (lib/portfolioMap.js separate): markers that would
// touch are pushed apart, kept inside the frame, and one moved off its true
// spot keeps a thin line back to it.
import { staticView, markerRadius, separate, TILE_ATTRIBUTION } from "../../lib/portfolioMap.js";

export default function StaticMap({ assets, width = 640, height = 280, label }) {
  const pts = assets.map((a, i) => ({ lat: a.lat, lon: a.lon, kw: a.kw, n: i + 1, name: a.name }));
  const v = staticView(pts, { width, height, pad: 40 });
  if (!v) return null;
  const maxKw = Math.max(...v.points.map((p) => p.kw || 0), 1);
  const placed = separate(v.points.map((p) => ({ ...p, r: Math.max(9, markerRadius(p.kw, maxKw, { min: 9, max: 15 })) })), { width, height });
  return (
    <div className="pf-smap" style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={label}>
      {v.tiles.map((t) => (
        <span key={t.key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.src} alt="" width={256} height={256} style={{ left: (t.left / width) * 100 + "%", top: (t.top / height) * 100 + "%", width: (256 / width) * 100 + "%" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.ref} alt="" width={256} height={256} style={{ left: (t.left / width) * 100 + "%", top: (t.top / height) * 100 + "%", width: (256 / width) * 100 + "%" }} />
        </span>
      ))}
      {/* a moved marker keeps a line back to its true spot */}
      <svg className="pf-smap-lines" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {placed.filter((p) => p.moved).map((p) => (
          <g key={p.n}>
            <line x1={p.x0} y1={p.y0} x2={p.x} y2={p.y} />
            <circle cx={p.x0} cy={p.y0} r="2.2" />
          </g>
        ))}
      </svg>
      {placed.map((p) => (
        <span key={p.n} className="pf-smap-pin" title={p.name}
          style={{ left: (p.x / width) * 100 + "%", top: (p.y / height) * 100 + "%", width: p.r * 2, height: p.r * 2 }}>{p.n}</span>
      ))}
      <small className="pf-smap-attr">{TILE_ATTRIBUTION}</small>
    </div>
  );
}
