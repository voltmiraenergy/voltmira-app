// components/portfolio/GridStaticMap.jsx — the grid around a plant for the
// printed documents, where scripts are blocked: positioned tile images
// (lib/portfolioMap.js staticView) and an SVG on top with the lines in one
// colour per voltage class, the substations as squares, the connection route
// (drawn, or the straight line dashed) and the site. Server-renderable.
import { staticView, project, TILE_ATTRIBUTION } from "../../lib/portfolioMap.js";

const COLOR = { hv: "#B4472F", 110: "#B46A00", 35: "#2A6FC0" };

export default function GridStaticMap({ grid, site, chosen = null, route = null, width = 720, height = 380, label }) {
  if (!grid || !site) return null;
  // frame the site, the chosen point and its route, and the nearest substation of each class within 15 km
  const keyPts = [{ lat: site.lat, lon: site.lon }];
  if (chosen?.to) keyPts.push(chosen.to);
  (route || []).forEach((q) => keyPts.push({ lat: q[0], lon: q[1] }));
  for (const c of ["hv", "110", "35"]) {
    const n = grid.substations.find((x) => (x.classes || [x.cls]).includes(c));
    if (n && n.km < 15) keyPts.push({ lat: n.lat, lon: n.lon });
  }
  const v = staticView(keyPts, { width, height, pad: 46, maxZoom: 13 });
  if (!v) return null;
  const xy = (lat, lon) => { const p = project(lat, lon, v.z); return [p.x - v.left, p.y - v.top]; };
  const poly = (pts) => pts.map((q) => xy(q[0], q[1]).map((n) => n.toFixed(1)).join(",")).join(" ");
  const [sx, sy] = xy(site.lat, site.lon);
  const end = chosen?.to ? xy(chosen.to.lat, chosen.to.lon) : null;
  const routePts = route && route.length >= 2 ? route : chosen?.to ? [[site.lat, site.lon], [chosen.to.lat, chosen.to.lon]] : null;
  return (
    <div className="pf-smap gr-smap" style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={label}>
      {v.tiles.map((t) => (
        <span key={t.key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.src} alt="" width={256} height={256} style={{ left: (t.left / width) * 100 + "%", top: (t.top / height) * 100 + "%", width: (256 / width) * 100 + "%" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.ref} alt="" width={256} height={256} style={{ left: (t.left / width) * 100 + "%", top: (t.top / height) * 100 + "%", width: (256 / width) * 100 + "%" }} />
        </span>
      ))}
      <svg className="gr-smap-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {grid.paths.map((p) => <polyline key={p.id} points={poly(p.path)} fill="none" stroke={COLOR[p.cls]} strokeWidth={p.cls === "35" ? 1.6 : 2.4} strokeOpacity="0.9" />)}
        {routePts && <polyline points={poly(routePts)} fill="none" stroke="#0B1F17" strokeWidth={route ? 3.2 : 2} strokeDasharray={route ? undefined : "7 6"} />}
        {grid.substations.map((s) => {
          const [x, y] = xy(s.lat, s.lon);
          if (x < -10 || y < -10 || x > width + 10 || y > height + 10) return null;
          const on = chosen && chosen.kind === "sub" && chosen.id === s.id;
          return <rect key={s.id} x={x - 5} y={y - 5} width="10" height="10" fill={COLOR[s.cls]} stroke={on ? "#0B1F17" : "#ffffff"} strokeWidth={on ? 3 : 1.6} />;
        })}
        {end && chosen.kind === "line" && <circle cx={end[0]} cy={end[1]} r="5" fill="#ffffff" stroke="#0B1F17" strokeWidth="2.2" />}
        <circle cx={sx} cy={sy} r="8" fill="#0F8A5F" stroke="#ffffff" strokeWidth="3" />
      </svg>
      <small className="pf-smap-attr">{TILE_ATTRIBUTION}; grid © OpenStreetMap contributors</small>
    </div>
  );
}
