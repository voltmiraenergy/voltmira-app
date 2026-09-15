// lib/addressFallback.js — local MD+RO locality dataset, the offline last
// resort behind components/AddressField.jsx when both Google Places and the
// live OpenStreetMap lookup fail. Same shape a geocoder would return:
// street + locality + region + coordinates — so picking a result disambiguates
// a street that exists in several towns, instead of a free-text guess.
//
// A handful of street names are deliberately repeated across different
// localities (Ștefan cel Mare, Mihai Eminescu, Alexandru cel Bun …) — that
// collision is exactly the problem the picker exists to solve.

export const PLACES = [
  { street: "Ștefan cel Mare", locality: "Chișinău", region: "Republica Moldova", lat: 47.0245, lng: 28.8322 },
  { street: "Ștefan cel Mare", locality: "Ialoveni", region: "Republica Moldova", lat: 46.9397, lng: 28.7776 },
  { street: "Ștefan cel Mare", locality: "Orhei", region: "Republica Moldova", lat: 47.3833, lng: 28.8228 },
  { street: "Ștefan cel Mare", locality: "Bălți", region: "Republica Moldova", lat: 47.7615, lng: 27.9289 },
  { street: "Ștefan cel Mare", locality: "Cahul", region: "Republica Moldova", lat: 45.9075, lng: 28.1958 },
  { street: "Ștefan cel Mare", locality: "Ungheni", region: "Republica Moldova", lat: 47.2086, lng: 27.7978 },

  { street: "Alexandru cel Bun", locality: "Ialoveni", region: "Republica Moldova", lat: 46.9412, lng: 28.7770 },
  { street: "Alexandru cel Bun", locality: "Chișinău", region: "Republica Moldova", lat: 47.0169, lng: 28.8500 },
  { street: "Alexandru cel Bun", locality: "Soroca", region: "Republica Moldova", lat: 48.1553, lng: 28.2966 },

  { street: "Mihai Eminescu", locality: "Chișinău", region: "Republica Moldova", lat: 47.0231, lng: 28.8481 },
  { street: "Mihai Eminescu", locality: "Bălți", region: "Republica Moldova", lat: 47.7548, lng: 27.9298 },
  { street: "Mihai Eminescu", locality: "Strășeni", region: "Republica Moldova", lat: 47.1447, lng: 28.6156 },
  { street: "Mihai Eminescu", locality: "Orhei", region: "Republica Moldova", lat: 47.3801, lng: 28.8256 },

  { street: "Vasile Alecsandri", locality: "Chișinău", region: "Republica Moldova", lat: 47.0203, lng: 28.8280 },
  { street: "Vasile Alecsandri", locality: "Ialoveni", region: "Republica Moldova", lat: 46.9370, lng: 28.7820 },

  { street: "Independenței", locality: "Chișinău, Botanica", region: "Republica Moldova", lat: 46.9885, lng: 28.8360 },
  { street: "Independenței", locality: "Strășeni", region: "Republica Moldova", lat: 47.1420, lng: 28.6190 },
  { street: "Independenței", locality: "Ungheni", region: "Republica Moldova", lat: 47.2050, lng: 27.8010 },

  { street: "Uzinelor", locality: "Chișinău", region: "Republica Moldova", lat: 47.0304, lng: 28.8912 },
  { street: "Petru Zadnipru", locality: "Chișinău", region: "Republica Moldova", lat: 47.0509, lng: 28.8785 },
  { street: "Ciocana", locality: "Chișinău, Ciocana", region: "Republica Moldova", lat: 47.0480, lng: 28.8990 },

  { street: "Donath", locality: "Cluj-Napoca", region: "România", lat: 46.7623, lng: 23.5558 },
  { street: "Memorandumului", locality: "Cluj-Napoca", region: "România", lat: 46.7700, lng: 23.5900 },
  { street: "DN7", locality: "Chiajna, jud. Ilfov", region: "România", lat: 44.4682, lng: 25.9760 },
  { street: "Republicii", locality: "Cluj-Napoca", region: "România", lat: 46.7750, lng: 23.6000 },
];

// Simple substring match on street or locality — a stand-in for a geocoder's
// ranked predictions. Diacritic-insensitive so "stefan" still finds "Ștefan".
const fold = (s) => String(s || "").toLowerCase()
  .replace(/[ăâ]/g, "a").replace(/î/g, "i").replace(/ș/g, "s").replace(/ț/g, "t");

export function searchPlaces(query, limit = 6) {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  return PLACES
    .filter((p) => fold(p.street).includes(q) || fold(p.locality).includes(q))
    .slice(0, limit);
}
