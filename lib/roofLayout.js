// lib/roofLayout.js — fits real, physical panels into a drawn roof plane,
// skipping its obstacles, instead of assuming a rooftop can hold whatever a
// kW target implies (lib/supplierCatalog.js's autoBom: kw*1000/panelWatt).
// Pure geometry, no I/O. A local equirectangular projection (fine at roof
// scale — tens of meters, not kilometers) turns the plane's lat/lon ring
// into meters; a grid of panel-sized rectangles (+ spacing) aligned to the
// plane's own longest edge is then tested against the polygon and its
// obstacles. No geometry library: this matches the codebase's style of
// small, dependency-free lib/ modules (lib/stringDesign.js, lib/leadSizing.js)
// rather than pulling in turf.js for one function.

const EARTH_R = 6371000; // meters, mean radius — plenty accurate at roof scale
const EPS = 1e-9; // guards grid-loop boundaries against float noise from the
                   // degrees<->meters round trip, so an exact-fit edge isn't
                   // dropped by a stray 1e-13 rounding error

function project(latlngs, originLat, originLon) {
  const cosLat = Math.cos(originLat * Math.PI / 180);
  return latlngs.map(([lat, lon]) => [
    (lon - originLon) * Math.PI / 180 * EARTH_R * cosLat,
    (lat - originLat) * Math.PI / 180 * EARTH_R,
  ]);
}

function unproject(xy, originLat, originLon) {
  const cosLat = Math.cos(originLat * Math.PI / 180);
  return xy.map(([x, y]) => [
    originLat + (y / EARTH_R) * 180 / Math.PI,
    originLon + (x / (EARTH_R * cosLat)) * 180 / Math.PI,
  ]);
}

function centroid(ring) {
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  return [sx / ring.length, sy / ring.length];
}

// Ray-casting point-in-polygon.
function pointInPolygon([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** A drawn roof plane's real area in m², via the shoelace formula on the
 * same local projection fitPanels uses — so a proposal can print the actual
 * measured roof instead of the flat kw*5.5 rule of thumb. */
export function polygonAreaM2(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const originLat = ring[0][0], originLon = ring[0][1];
  const xy = project(ring, originLat, originLon);
  let sum = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    sum += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
  }
  return Math.abs(sum) / 2;
}

// Standard 8-point compass, translated. PVGIS's own convention (aspect: 0 =
// south, -90 = east, 90 = west, ±180 = north) drives the tilt/azimuth values
// a plane is drawn with, so the label rotates that onto a normal compass
// heading rather than inventing a separate direction.
const COMPASS = [
  { ro: "Nord", en: "North", ru: "Север" },
  { ro: "Nord-Est", en: "Northeast", ru: "Северо-восток" },
  { ro: "Est", en: "East", ru: "Восток" },
  { ro: "Sud-Est", en: "Southeast", ru: "Юго-восток" },
  { ro: "Sud", en: "South", ru: "Юг" },
  { ro: "Sud-Vest", en: "Southwest", ru: "Юго-запад" },
  { ro: "Vest", en: "West", ru: "Запад" },
  { ro: "Nord-Vest", en: "Northwest", ru: "Северо-запад" },
];

/** e.g. compassLabel(-30, "ro") -> "Sud-Vest" */
export function compassLabel(azimuthDeg, lang) {
  const heading = ((azimuthDeg + 180) % 360 + 360) % 360;
  const idx = Math.round(heading / 45) % 8;
  return COMPASS[idx][lang] || COMPASS[idx].ro;
}

function pointInAABB([x, y], minX, minY, maxX, maxY) {
  return x >= minX - EPS && x <= maxX + EPS && y >= minY - EPS && y <= maxY + EPS;
}

function boundsOf(ring) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/**
 * Fit panel-sized rectangles into a roof plane polygon, skipping any that
 * overlap an obstacle.
 * @param {number[][]} planePolygon - ring of [lat,lon], 3+ points
 * @param {number[][][]} obstaclePolygons - array of rings, each [lat,lon][]
 * @param {number} panelWmm - panel width, mm
 * @param {number} panelHmm - panel height, mm
 * @param {object} [opts]
 * @param {number} [opts.spacingM=0.02] - gap between adjacent panels, meters
 * @param {number} [opts.marginM=0.3] - clearance kept from the plane's own edge, meters
 * @param {"portrait"|"landscape"} [opts.orientation="portrait"]
 * @returns {{panels: number[][][], count: number}} each panel as a [lat,lon] rectangle ring
 */
export function fitPanels(planePolygon, obstaclePolygons, panelWmm, panelHmm, opts = {}) {
  if (!Array.isArray(planePolygon) || planePolygon.length < 3) return { panels: [], count: 0 };
  if (!(panelWmm > 0) || !(panelHmm > 0)) return { panels: [], count: 0 };

  const spacingM = opts.spacingM ?? 0.02;
  const marginM = opts.marginM ?? 0.3;
  const landscape = opts.orientation === "landscape";
  const pw = (landscape ? panelHmm : panelWmm) / 1000;
  const ph = (landscape ? panelWmm : panelHmm) / 1000;

  const originLat = planePolygon[0][0], originLon = planePolygon[0][1];
  const ring = project(planePolygon, originLat, originLon);
  const obstacles = (Array.isArray(obstaclePolygons) ? obstaclePolygons : [])
    .map((o) => (Array.isArray(o) ? project(o, originLat, originLon) : []))
    .filter((o) => o.length >= 3);

  // Align the grid to the plane's own longest edge, so rows run along the
  // roof rather than a fixed compass direction — closer to how panels are
  // actually racked on a sloped plane.
  let bestAngle = 0, bestLen = -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > bestLen) { bestLen = len; bestAngle = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }

  const [ocx, ocy] = centroid(ring);
  const cosA = Math.cos(bestAngle), sinA = Math.sin(bestAngle);
  // World -> grid (rotate by -bestAngle around the centroid)
  const toGrid = ([x, y]) => {
    const dx = x - ocx, dy = y - ocy;
    return [dx * cosA + dy * sinA, -dx * sinA + dy * cosA];
  };
  // Grid -> world (inverse rotation)
  const fromGrid = ([gx, gy]) => [ocx + gx * cosA - gy * sinA, ocy + gx * sinA + gy * cosA];

  const gridRing = ring.map(toGrid);
  const gridObstacles = obstacles.map((o) => o.map(toGrid));
  const b = boundsOf(gridRing);
  const stepX = pw + spacingM, stepY = ph + spacingM;
  const minX = b.minX + marginM, maxX = b.maxX - marginM;
  const minY = b.minY + marginM, maxY = b.maxY - marginM;

  const panelsGrid = [];
  for (let gy = minY; gy + ph <= maxY + EPS; gy += stepY) {
    for (let gx = minX; gx + pw <= maxX + EPS; gx += stepX) {
      const corners = [[gx, gy], [gx + pw, gy], [gx + pw, gy + ph], [gx, gy + ph]];
      // Ray-casting treats a point exactly ON an edge as ambiguous (often
      // "outside"), which would reject an exact-fit panel whose corner lands
      // precisely on the plane's own boundary. Nudge each corner a fraction
      // of a millimeter toward the panel's own center before testing
      // containment — negligible for real corners, but resolves that edge
      // case without ever admitting a corner that's actually outside.
      const cx = gx + pw / 2, cy = gy + ph / 2;
      const testCorners = corners.map(([x, y]) => [x + Math.sign(cx - x) * 1e-4, y + Math.sign(cy - y) * 1e-4]);
      if (!testCorners.every((c) => pointInPolygon(c, gridRing))) continue;
      const hitsObstacle = gridObstacles.some((o) => {
        if (corners.some((c) => pointInPolygon(c, o))) return true;
        if (pointInPolygon([gx + pw / 2, gy + ph / 2], o)) return true;
        // A small obstacle fully inside one panel cell touches none of that
        // panel's corners and isn't hit by a center-point test either unless
        // it happens to cover the center — catch that case from the other
        // side: any obstacle vertex landing inside this panel's cell.
        return o.some((oc) => pointInAABB(oc, gx, gy, gx + pw, gy + ph));
      });
      if (hitsObstacle) continue;
      panelsGrid.push(corners);
    }
  }

  const panels = panelsGrid.map((corners) => unproject(corners.map(fromGrid), originLat, originLon));
  return { panels, count: panels.length };
}
