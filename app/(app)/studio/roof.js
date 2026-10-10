// app/(app)/studio/roof.js — the roof-yield math shared by the Site Survey
// tool and the Configuration Workspace's Site & Roof step, so there is one
// definition of "how pitch/azimuth/shading turn into a yield factor," not
// two copies that can quietly drift apart.
export const TILT_PTS = [[0, 0.86], [10, 0.93], [20, 0.985], [33, 1.0], [45, 0.985], [60, 0.92], [75, 0.83], [90, 0.72]];
export const AZ_PTS = [[0, 1.0], [30, 0.98], [45, 0.95], [90, 0.83], [135, 0.68], [180, 0.58]];
export const SHADE = { none: 1.0, light: 0.95, mod: 0.88, heavy: 0.75 };

export function lerpPts(pts, x) {
  x = Math.abs(x);
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return pts[pts.length - 1][1];
}

// pitch in degrees (0-90), az in degrees from due south (E-/W+), shade one of
// SHADE's keys — returns a multiplier on the optimal-plane yield.
export function computeRoofFactor(pitch, az, shade) {
  return lerpPts(TILT_PTS, pitch) * lerpPts(AZ_PTS, az) * (SHADE[shade] ?? 1);
}

export const DIRS = [[0, "S"], [45, "SV"], [90, "V"], [135, "NV"], [180, "N"], [-45, "SE"], [-90, "E"], [-135, "NE"]];
export function dirLabel(az) {
  let best = DIRS[0], bd = 999;
  for (const d of DIRS) { const dd = Math.abs(((az - d[0] + 540) % 360) - 180); if (dd < bd) { bd = dd; best = d; } }
  return best[1];
}
