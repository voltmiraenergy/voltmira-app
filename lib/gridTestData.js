// lib/gridTestData.js — an Overpass answer around the sample site, shaped as
// the API returns it, for the grid tests (lib/gridNear.test.js,
// lib/gridOptions.test.js). Not used by the app.
export const JSON_FIXTURE = {
  elements: [
    { type: "way", id: 1, center: { lat: 45.8835, lon: 28.1831 }, tags: { power: "substation", name: "Cahul", voltage: "110000" } },
    { type: "way", id: 2, center: { lat: 45.9192, lon: 28.3587 }, tags: { power: "substation", voltage: "35000", substation: "distribution" } },
    { type: "way", id: 3, center: { lat: 45.7101, lon: 28.5007 }, tags: { power: "substation", name: "Vulcănești", voltage: "400000;110000;10000" } },
    { type: "node", id: 4, lat: 45.95, lon: 28.34, tags: { power: "substation", voltage: "10000" } },
    { type: "node", id: 5, lat: 46.0, lon: 28.3, tags: { power: "substation", substation: "transmission" } },
    { type: "way", id: 10, tags: { power: "line", voltage: "110000", name: "LEA 110 kV" }, geometry: [{ lat: 45.96, lon: 28.2 }, { lat: 45.96, lon: 28.25 }, { lat: 45.96, lon: 28.5 }] },
    { type: "way", id: 11, tags: { power: "line", voltage: "35000" }, geometry: [{ lat: 45.90, lon: 28.2 }, { lat: 45.90, lon: 28.5 }] },
    { type: "way", id: 12, tags: { power: "line", voltage: "10000" }, geometry: [{ lat: 45.95, lon: 28.2 }, { lat: 45.95, lon: 28.5 }] },
  ],
};
