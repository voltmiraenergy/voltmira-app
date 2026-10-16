// lib/googleSatellite.js — Google's satellite imagery as a Leaflet layer, for
// the roof designer and the plant designer, when the installer's own Google
// Maps key is set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; billing on their own
// Google Cloud project). Google's terms allow its tiles only through its own
// JavaScript API, which leaflet.gridlayer.googlemutant wraps; raw tile URLs
// are never used. Any failure (bad key, network, billing off) resolves to
// null, so the map falls back to Esri instead of staying blank.

let scriptPromise = null;
function loadGoogleMapsScript(key) {
  if (window.google?.maps) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("google maps script failed to load")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/** The Google satellite layer, or null when there is no key or it cannot load. */
export async function loadGoogleSatelliteLayer(L, key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, { maxZoom = 21 } = {}) {
  if (!key) return null;
  try {
    await loadGoogleMapsScript(key);
    await import("leaflet.gridlayer.googlemutant");
    return L.gridLayer.googleMutant({ type: "satellite", maxZoom });
  } catch {
    return null;
  }
}
