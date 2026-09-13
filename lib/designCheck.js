// lib/designCheck.js — the engineering checks that decide whether a system is
// actually buildable, not just profitable.
//
// Pure functions, no React: the installer's editor renders these as a live card
// (components/DesignChecks.jsx) and the client's proposal PDF prints the same
// rows as an engineering annex (app/p/[code]/PrintSheet.jsx, a server
// component). Both read from here so the document can never claim a check the
// screen didn't run — or vice versa.
//
// Everything runs off the equipment actually in the bill of materials: the real
// panel's Voc and temperature coefficient, the real inverter's max DC voltage
// and AC rating. With no BOM it falls back to representative defaults and says
// so, rather than pretending to have checked.
import { PANELS, INVERTERS, findPanel, DEFAULT_IDS } from "./supplierCatalog.js";
import { T_COLD, T_STC, T_HOT_CELL, stringRange, stringCurrentOk } from "./stringDesign.js";
import { backupHours } from "./batteryBackup.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

// Re-exported so existing callers importing the design temperatures from here
// (this file predates stringDesign.js) keep working unchanged.
export { T_COLD, T_STC };

/** Match a BOM line back to a catalogue entry so its real specs are available. */
function specFor(list, line) {
  if (!line) return null;
  return list.find((p) => p.brand === line.brand && p.model === line.model) || null;
}

export function designCheck({ bom = [], kw = 0, battKwh = 0, consKwh = 0, phases }) {
  const lines = Array.isArray(bom) ? bom : [];
  const panelLine = lines.find((l) => l.kind === "panel" && (Number(l.qty) || 0) > 0);
  const invLine = lines.find((l) => l.kind === "inverter" && (Number(l.qty) || 0) > 0);

  const panel = specFor(PANELS, panelLine) || findPanel(DEFAULT_IDS.panel);
  const inverter = specFor(INVERTERS, invLine) || null;
  const fromBom = { panel: !!specFor(PANELS, panelLine), inverter: !!inverter };

  // Module count: what the BOM says if it says anything, otherwise what the
  // system size implies.
  const modules = panelLine ? Math.max(1, Math.round(Number(panelLine.qty) || 0))
    : Math.max(1, Math.ceil((kw * 1000) / panel.watt));
  const dcKw = (modules * panel.watt) / 1000;

  // AC side: the BOM's inverters if present, else a sensibly sized one.
  const nInv = invLine ? Math.max(1, Math.round(Number(invLine.qty) || 0)) : 1;
  const ph = phases || (dcKw > 6 ? 3 : 1);
  const acKw = inverter ? inverter.kw * nInv : Math.max(3, Math.round((dcKw / 1.15) / 0.5) * 0.5);
  const maxDcV = inverter ? inverter.maxDcV : (ph === 3 ? 800 : 500);
  const mppt = inverter ? inverter.mppt * nInv : 2;

  const dcac = acKw > 0 ? dcKw / acKw : 0;
  // Above ~1.30 the inverter clips the peak of sunny days. A little is normal
  // and even desirable; a lot is capacity the client paid for and never gets.
  const clipPct = dcac > 1.3 ? Math.round((dcac - 1.15) * 22) : 0;

  // Strings: spread the modules over the available MPPT inputs, then check the
  // worst-case cold Voc of the longest string.
  const strings = Math.max(1, Math.min(mppt * 2, Math.ceil(dcKw / 5.5)));
  const perString = Math.ceil(modules / strings);
  const vocCold = panel.voc * (1 + (panel.tempCoeff / 100) * (T_COLD - T_STC));
  const vString = perString * vocCold;
  const vHeadroom = maxDcV > 0 ? (1 - vString / maxDcV) * 100 : 0;

  // Evening load a battery has to carry: roughly half a day's consumption.
  const eveningKwh = ((Number(consKwh) || 0) / 365) * 0.5;
  const battSmall = battKwh > 0 && battKwh < eveningKwh * 0.7;

  // The real string-design window (cold-Voc ceiling AND hot-Vmpp floor), only
  // computable against a real inverter — the representative maxDcV fallback
  // above has no minMpptV/maxInputCurrentA to check against, so this stays
  // null until the BOM actually names one, rather than validating against
  // numbers nobody chose.
  const range = inverter ? stringRange(panel, inverter) : null;
  const lenOk = range ? (perString >= range.min && perString <= range.max) : null;

  return {
    panel, inverter, fromBom, modules, dcKw, nInv, acKw, ph, maxDcV,
    dcac, clipPct, strings, perString, vocCold, vString, vHeadroom,
    vWarn: vString > maxDcV, eveningKwh, battSmall,
    // Sanitized annual consumption, carried through so callers (the battery
    // row below, and anything client-facing) can compute backup-runtime hours
    // (lib/batteryBackup.js) without re-deriving it from eveningKwh's
    // half-day assumption.
    consKwh: Number(consKwh) || 0,
    mvLevel: kw > 100,
    // MPPT input count, so callers can name each input (A, B, C…) instead of
    // one aggregated "N strings" line — see stringInputs() below.
    mppt,
    // Valid modules-per-string window against the REAL inverter in the BOM —
    // null (not false) when there's no real inverter to check against yet, so
    // a caller can tell "not applicable" apart from "checked and failed".
    stringRangeInfo: range, lenOk,
  };
}

/**
 * The string layout named per MPPT input — "Input A / Input B", the shape a
 * real inverter datasheet (and Sunny Design's own inverter-design page) uses,
 * instead of one aggregated "N strings" line. Strings are split evenly across
 * the available inputs: a real design tool balances inputs for shading and
 * orientation, which a quoting tool has no roof survey to do — the even split
 * is the honest simplification, not a claim of an optimized layout.
 *
 * Each input's `ok` also carries the current check for however many strings
 * land on THAT input — a design can be voltage-safe and still overload one
 * MPPT input by paralleling too many strings onto it — using the real
 * panel/inverter from `d` when designCheck() found one; with only the
 * representative fallback (no real inverter chosen yet) it falls back to the
 * plain cold-Voc-vs-maxDcV comparison this always had, exactly as before.
 *
 * Also carries the per-input numbers a real inverter-design report shows
 * (peak DC power, the actual hot-Vmpp against the inverter's MPPT floor, the
 * actual short-circuit current against its per-input ceiling) — everything
 * derivable from the SAME two catalogue rows already matched above. `null`
 * (not false) on vmppHotActual/vmppOk/minMpptV/maxInputCurrentA/
 * maxInputCurrentA when there's no real inverter to check against, so a
 * caller can render "not applicable" rather than a false failure.
 *
 * @param {ReturnType<typeof designCheck>} d
 * @returns {{label, strings, modulesPerString, peakKw, vString, maxDcV, vocOk,
 *   vmppHotActual, minMpptV, vmppOk, iscTotalA, maxInputCurrentA, currentOk, ok}[]}
 */
export function stringInputs(d) {
  const nInputs = Math.max(1, Math.min(d.mppt || 2, d.strings));
  const perInput = Math.ceil(d.strings / nInputs);
  // d.panel is only optional here because a few unit tests exercise this
  // function directly with a bare {mppt,strings,perString,vString,maxDcV}
  // fixture — real callers (designCheck()'s own return value) always carry a
  // panel, real or the representative fallback, so this only ever defaults to
  // 0 in that isolated-test path.
  const panelWatt = Number(d.panel?.watt) || 0;
  const panelIsc = Number(d.panel?.isc) || 0;
  const minMpptV = d.inverter ? (Number(d.inverter.minMpptV) || 0) : 0;
  const maxInputCurrentA = d.inverter ? (Number(d.inverter.maxInputCurrentA) || 0) : 0;
  const vmppHotActual = d.stringRangeInfo ? d.perString * d.stringRangeInfo.vmppHot : null;
  const vocOk = d.vString <= d.maxDcV;
  const vmppOk = vmppHotActual != null && minMpptV > 0 ? vmppHotActual >= minMpptV : null;
  const out = [];
  for (let i = 0; i < nInputs; i++) {
    const stringsHere = Math.min(perInput, d.strings - i * perInput);
    const currentOk = d.inverter ? stringCurrentOk(d.panel, d.inverter, stringsHere) : true;
    const lenOk = d.stringRangeInfo ? d.lenOk : vocOk;
    out.push({
      label: String.fromCharCode(65 + i), // A, B, C…
      strings: stringsHere,
      modulesPerString: d.perString,
      peakKw: (stringsHere * d.perString * panelWatt) / 1000,
      vString: d.vString,
      maxDcV: d.maxDcV,
      vocOk,
      vmppHotActual,
      minMpptV: minMpptV || null,
      vmppOk,
      iscTotalA: panelIsc * stringsHere,
      maxInputCurrentA: maxInputCurrentA || null,
      currentOk,
      ok: lenOk && currentOk,
    });
  }
  return out;
}

/**
 * One sentence naming the equipment the checks were run against — or admitting
 * that no BOM exists yet and representative parts were used instead.
 */
export function designCheckLead(d, lang) {
  const gear = `${d.panel.brand} ${d.panel.model}${d.inverter ? ` + ${d.inverter.brand} ${d.inverter.model}` : ""}`;
  return d.fromBom.panel || d.fromBom.inverter
    ? t3(lang,
        `Calculate pe echipamentul din deviz: ${gear}.`,
        `Computed on the equipment in the bill of materials: ${gear}.`,
        `Рассчитано по оборудованию из сметы: ${gear}.`)
    : t3(lang,
        "Încă nu ai echipament în deviz, așa că verificările folosesc un panou și un invertor reprezentative. Completează devizul ca să fie verificat sistemul real.",
        "No equipment in the bill of materials yet, so these use a representative panel and inverter. Fill the BOM to check the real system.",
        "В смете пока нет оборудования, поэтому проверки используют типовые панель и инвертор.");
}

/**
 * The checks as plain rows — `{ ok, label, value, detail, note, warn }`, already
 * localised. The editor renders them as a list, the PDF as a table; neither
 * owns the wording, so a warning can't say one thing on screen and another on
 * the document the client keeps.
 */
export function designCheckRows(d, { lang, battKwh = 0 } = {}) {
  const rows = [
    {
      ok: d.clipPct <= 8,
      label: t3(lang, "Raport DC/AC", "DC/AC ratio", "Соотношение DC/AC"),
      value: d.dcac.toFixed(2),
      detail: `${d.dcKw.toFixed(1)} kWp DC / ${d.acKw.toFixed(1)} kW AC`,
      warn: d.clipPct > 8 ? t3(lang,
        `invertorul taie ~${d.clipPct}% din vârfuri — clientul plătește panouri pe care nu le folosește`,
        `the inverter clips ~${d.clipPct}% of peaks — the client pays for modules they never use`,
        `инвертор срезает ~${d.clipPct}% пиков`) : null,
    },
    {
      ok: !d.vWarn,
      label: t3(lang, "Tensiune string la rece", "String voltage when cold", "Напряжение стринга на холоде"),
      value: `${Math.round(d.vString)} V / ${d.maxDcV} V`,
      detail: t3(lang,
        `${d.strings} string${d.strings > 1 ? "-uri" : ""} × ${d.perString} module · Voc la ${T_COLD}°C = ${d.vocCold.toFixed(1)} V`,
        `${d.strings} string${d.strings > 1 ? "s" : ""} × ${d.perString} modules · Voc at ${T_COLD}°C = ${d.vocCold.toFixed(1)} V`,
        `${d.strings} стринг(ов) × ${d.perString} модулей · Voc при ${T_COLD}°C = ${d.vocCold.toFixed(1)} В`),
      warn: d.vWarn ? t3(lang,
        "peste maximul DC al invertorului la cea mai rece zi — scurtează stringul, altfel invertorul se distruge și garanția cade",
        "over the inverter's DC maximum on the coldest day — shorten the string, or the inverter is destroyed and the warranty void",
        "выше максимума DC инвертора в самый холодный день — укоротите стринг") : null,
      note: d.vWarn ? null : t3(lang,
        `rezervă ${d.vHeadroom.toFixed(0)}%`, `${d.vHeadroom.toFixed(0)}% headroom`, `запас ${d.vHeadroom.toFixed(0)}%`),
    },
  ];

  // Only checkable against a REAL inverter (stringRangeInfo is null otherwise
  // — see designCheck() above) — a representative fallback has no minMpptV or
  // maxInputCurrentA to validate against. This is a second failure mode the
  // cold-Voc row above can't see: a string too SHORT loses MPPT tracking on a
  // hot afternoon even though it never comes close to the inverter's DC max.
  if (d.stringRangeInfo) {
    const r = d.stringRangeInfo;
    const allCurrentOk = stringInputs(d).every((row) => row.currentOk);
    rows.push({
      ok: !!d.lenOk && allCurrentOk,
      label: t3(lang, "Proiectare string validată", "Validated string design", "Проверенный дизайн стрингов"),
      value: r.possible
        ? `${r.min}–${r.max} ${t3(lang, "module/string", "modules/string", "модулей/стринг")}`
        : t3(lang, "nicio lungime validă", "no valid length", "нет допустимой длины"),
      detail: t3(lang,
        `${d.perString} module în stringurile actuale · Vmpp la ${T_HOT_CELL}°C = ${r.vmppHot.toFixed(1)} V (minim invertor)`,
        `${d.perString} modules in the current strings · Vmpp at ${T_HOT_CELL}°C = ${r.vmppHot.toFixed(1)} V (inverter minimum)`,
        `${d.perString} модулей в текущих стрингах · Vmpp при ${T_HOT_CELL}°C = ${r.vmppHot.toFixed(1)} В (минимум инвертора)`),
      warn: !r.possible
        ? t3(lang,
            "acest panou și acest invertor nu pot fi conectate la nicio lungime — schimbă unul din ele",
            "this panel and inverter can't be strung together at any length — change one of them",
            "эту панель и инвертор нельзя соединить ни при какой длине — замените один из них")
        : !d.lenOk
          ? t3(lang,
              `${d.perString} module e în afara intervalului valid — la cald tensiunea poate cădea sub pragul MPPT și invertorul nu mai urmărește punctul de putere maximă`,
              `${d.perString} modules falls outside the valid range — at high temperature the voltage can drop below the MPPT threshold and the inverter loses its tracking point`,
              `${d.perString} модулей вне допустимого диапазона — в жару напряжение может упасть ниже порога MPPT`)
          : !allCurrentOk
            ? t3(lang,
                "prea multe stringuri în paralel pe o intrare MPPT — curentul depășește maximul invertorului pentru acea intrare",
                "too many parallel strings on one MPPT input — the combined current exceeds that input's rating",
                "слишком много параллельных стрингов на одном входе MPPT — ток превышает номинал")
            : null,
    });
  }

  if (battKwh > 0) {
    // Hours of backup at the household's own average draw — the honest,
    // computable number behind treating a battery as its own product, not
    // just a bill-savings add-on (see lib/batteryBackup.js). null (no
    // consumption entered yet) is simply omitted, never shown as 0h.
    const hrs = backupHours(battKwh, d.consKwh);
    const hoursNote = hrs != null ? t3(lang,
      ` · ~${hrs.toFixed(0)} h de rezervă la consum mediu`,
      ` · ~${hrs.toFixed(0)} h of backup at average draw`,
      ` · ~${hrs.toFixed(0)} ч резерва при среднем потреблении`) : "";
    rows.push({
      ok: !d.battSmall,
      label: t3(lang, "Baterie vs. consum de seară", "Battery vs. evening load", "Батарея против вечерней нагрузки"),
      value: `${battKwh.toFixed(1)} kWh / ${d.eveningKwh.toFixed(1)} kWh`,
      detail: t3(lang, "jumătate din consumul unei zile medii", "half of an average day's use", "половина дневного потребления") + hoursNote,
      warn: d.battSmall ? t3(lang,
        "nu acoperă seara — surplusul tot pleacă în rețea la prețul de răscumpărare",
        "doesn't cover the evening — the surplus still leaves at the buy-back price",
        "не покрывает вечер — излишек всё равно уходит в сеть") : null,
    });
  }

  if (d.mvLevel) {
    rows.push({
      ok: true,
      label: t3(lang, "Nivel de racordare", "Connection level", "Уровень подключения"),
      value: t3(lang, "medie tensiune", "medium voltage", "среднее напряжение"),
      detail: t3(lang, "peste 100 kW — racord dedicat, aviz separat", "over 100 kW — dedicated feeder, separate approval", "свыше 100 кВт — отдельное подключение"),
      warn: null,
    });
  }

  return rows;
}
