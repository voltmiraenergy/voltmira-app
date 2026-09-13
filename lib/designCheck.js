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

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

// Coldest design cell temperature for MD/RO. Voc rises as temperature falls, so
// this is the worst case for the inverter's DC input — the one that matters.
export const T_COLD = -15, T_STC = 25;

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

  return {
    panel, inverter, fromBom, modules, dcKw, nInv, acKw, ph, maxDcV,
    dcac, clipPct, strings, perString, vocCold, vString, vHeadroom,
    vWarn: vString > maxDcV, eveningKwh, battSmall,
    mvLevel: kw > 100,
  };
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
export function designCheckRows(d, { lang, battKwh = 0, selfPct = null } = {}) {
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

  if (battKwh > 0) {
    rows.push({
      ok: !d.battSmall,
      label: t3(lang, "Baterie vs. consum de seară", "Battery vs. evening load", "Батарея против вечерней нагрузки"),
      value: `${battKwh.toFixed(1)} kWh / ${d.eveningKwh.toFixed(1)} kWh`,
      detail: t3(lang, "jumătate din consumul unei zile medii", "half of an average day's use", "половина дневного потребления"),
      warn: d.battSmall ? t3(lang,
        "nu acoperă seara — surplusul tot pleacă în rețea la prețul de răscumpărare",
        "doesn't cover the evening — the surplus still leaves at the buy-back price",
        "не покрывает вечер — излишек всё равно уходит в сеть") : null,
    });
  }

  if (selfPct != null) {
    const selfLow = selfPct < 45;
    rows.push({
      ok: !selfLow,
      label: t3(lang, "Autoconsum", "Self-consumption", "Самопотребление"),
      value: `${selfPct}%`,
      detail: t3(lang, "din producția anuală", "of annual production", "от годовой выработки"),
      warn: selfLow ? t3(lang,
        "sub 45% — cea mai mare parte a producției se vinde, nu se folosește",
        "under 45% — most of the production is sold rather than used",
        "ниже 45% — большая часть выработки продаётся, а не используется") : null,
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
