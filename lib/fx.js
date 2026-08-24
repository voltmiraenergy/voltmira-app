// lib/fx.js — live EUR reference rates, with the engine's constants as fallback.
//
// Quoting happens entirely in EUR (see engine.js), so any invoice in MDL or RON
// is a conversion. The engine ships static rates for that, but they drift:
// checked on 2026-08-21 the constants were MDL 19.8 vs an actual 19.99 (0.9%)
// and RON 4.97 vs an actual 5.25 (5.7%). On a €23,375 system the RON error alone
// was ~6,600 RON — on a document a client pays against.
//
// SOURCES
//   RON — ECB euro reference rates. The obvious choice, BNR, now 302s
//         /nbrfxrates.xml to its homepage, so that feed is gone.
//   MDL — Banca Naţională a Moldovei. MDL is not an EU currency, so the ECB
//         does not publish it; BNM is the authoritative source and quotes
//         directly as MDL per 1 EUR, which is the direction we need.
//
// This must NEVER block an invoice from rendering: every fetch is time-boxed,
// failures fall back to the static rate, and the caller is told which was used
// so the document can disclose it honestly.
import { FX as STATIC_FX } from "@voltmira/engine";

// Central banks publish once per working day; six hours keeps us current
// without hammering them, and the Next data cache is shared across instances.
const REVALIDATE_SECONDS = 6 * 60 * 60;
const FETCH_TIMEOUT_MS = 4000;

// Second layer, per container: avoids even the cache lookup on a warm hit.
let memo = { at: 0, value: null };
const MEMO_TTL_MS = 60 * 60 * 1000;

async function getXml(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS },
    headers: { accept: "application/xml,text/xml,*/*" },
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.text();
}

/** ECB daily reference rates → RON per 1 EUR. */
async function ecbRon() {
  const xml = await getXml("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
  const rate = xml.match(/currency=['"]RON['"]\s+rate=['"]([\d.]+)['"]/)
    || xml.match(/rate=['"]([\d.]+)['"]\s+currency=['"]RON['"]/);
  const day = xml.match(/time=['"]([\d-]+)['"]/);
  const v = Number(rate?.[1]);
  if (!(v > 0)) throw new Error("ron_not_found");
  return { rate: v, asOf: day?.[1] || null, source: "ECB" };
}

/** BNM official rate → MDL per 1 EUR. Requires an explicit dd.mm.yyyy date. */
async function bnmMdl() {
  const d = new Date();
  const stamp = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const xml = await getXml(`https://www.bnm.md/en/official_exchange_rates?get_xml=1&date=${stamp}`);
  // Pull the EUR block specifically — the document lists every currency, and a
  // bare <Value> match would grab whichever happened to come first.
  const block = xml.match(/<Valute[^>]*>\s*<NumCode>978<\/NumCode>[\s\S]*?<\/Valute>/)
    || xml.match(/<Valute[^>]*>[\s\S]*?<CharCode>EUR<\/CharCode>[\s\S]*?<\/Valute>/);
  const v = Number(block?.[0].match(/<Value>([\d.]+)<\/Value>/)?.[1]);
  const nominal = Number(block?.[0].match(/<Nominal>(\d+)<\/Nominal>/)?.[1]) || 1;
  if (!(v > 0)) throw new Error("mdl_not_found");
  const day = xml.match(/Date="([\d.]+)"/)?.[1] || null;
  return { rate: v / nominal, asOf: day, source: "BNM" };
}

/**
 * Live rates per 1 EUR, with provenance.
 * @returns {Promise<{rates:{EUR:number,RON:number,MDL:number},
 *                    meta:Record<string,{source:string,asOf:string|null,live:boolean}>}>}
 */
export async function getFxRates() {
  if (memo.value && Date.now() - memo.at < MEMO_TTL_MS) return memo.value;

  const [ron, mdl] = await Promise.allSettled([ecbRon(), bnmMdl()]);
  const pick = (settled, code) => settled.status === "fulfilled"
    ? { rate: settled.value.rate, source: settled.value.source, asOf: settled.value.asOf, live: true }
    : { rate: Number(STATIC_FX[code]) || 1, source: "static", asOf: null, live: false };

  const R = pick(ron, "RON");
  const M = pick(mdl, "MDL");
  if (!R.live) console.warn("[fx] RON fell back to static:", ron.reason?.message);
  if (!M.live) console.warn("[fx] MDL fell back to static:", mdl.reason?.message);

  const value = {
    rates: { EUR: 1, RON: R.rate, MDL: M.rate },
    meta: {
      EUR: { source: "base", asOf: null, live: true },
      RON: { source: R.source, asOf: R.asOf, live: R.live },
      MDL: { source: M.source, asOf: M.asOf, live: M.live },
    },
  };
  memo = { at: Date.now(), value };
  return value;
}

/** One currency, never throwing. Falls back to the engine constant. */
export async function getRate(currency) {
  const code = String(currency || "EUR").toUpperCase();
  if (code === "EUR") return { rate: 1, source: "base", asOf: null, live: true };
  try {
    const { rates, meta } = await getFxRates();
    return { rate: rates[code] ?? Number(STATIC_FX[code]) ?? 1, ...(meta[code] || {}) };
  } catch (e) {
    console.error("[fx] lookup failed:", e?.message || e);
    return { rate: Number(STATIC_FX[code]) || 1, source: "static", asOf: null, live: false };
  }
}
