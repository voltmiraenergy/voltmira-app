// lib/lenderText.js — the words of the lender questions document
// (lib/lenderQuestions.js), in the bank pack's two languages: Romanian for the
// Moldovan banks, English for co-lenders. Plain words, no dashes or middle
// dots; every figure is filled in from the model, never written here.

export const LQ = {
  title: { en: "Questions a lender will ask: {name}", ro: "Întrebările unui creditor: {name}" },
  by: { en: "Prepared by {co} with VoltMira on {date}. Report ID {rid}.", ro: "Pregătit de {co} cu VoltMira la {date}. ID raport {rid}." },
  intro: { en: "Each answer gives the figure and where it sits in the financial model (02-financial-model.xlsx in the data room, 03-financial-model.xlsx in a bank pack), so it can be checked and changed there.", ro: "Fiecare răspuns dă cifra și locul ei în modelul financiar (02-financial-model.xlsx în camera de date, 03-financial-model.xlsx în pachetul pentru bancă), ca să poată fi verificată și schimbată acolo." },
  where: { en: "In the model: {x}", ro: "În model: {x}" },
  plant_h: { en: "{name}", ro: "{name}" },
  na: { en: "not set", ro: "nesetat" },

  q_energy: { en: "Where does the energy figure come from, and how is P90 built?", ro: "De unde vine cifra de energie și cum se obține P90?" },
  a_wind_study: { en: "Wind: the independent study by {by}{date}, P50 {p50} MWh a year, P90 {p90} MWh a year{basis}. The model's uncertainty, {sig}% at one sigma, is worked back from the study's own P50 and P90.", ro: "Vânt: studiul independent al {by}{date}, P50 {p50} MWh pe an, P90 {p90} MWh pe an{basis}. Incertitudinea din model, {sig}% la o sigma, e calculată din P50 și P90 ale studiului." },
  basis_1y: { en: " (one-year P90)", ro: " (P90 pe un an)" },
  basis_10y: { en: " (ten-year P90)", ro: " (P90 pe zece ani)" },
  a_wind_screen: { en: "Wind: a screening estimate from public wind data at {hub} m hub height, P50 {p50} MWh a year, with {wl}% losses. It is not a measured resource assessment: the model assumes {sig}% uncertainty at one sigma until an independent study replaces it.", ro: "Vânt: o estimare preliminară din date publice de vânt la înălțimea butucului de {hub} m, P50 {p50} MWh pe an, cu pierderi de {wl}%. Nu e o evaluare măsurată a resursei: modelul presupune o incertitudine de {sig}% la o sigma până când un studiu independent o înlocuiește." },
  a_wind_none: { en: "Wind: no energy figure yet (no study and no screening).", ro: "Vânt: încă nu există o cifră de energie (nici studiu, nici estimare preliminară)." },
  a_solar_study: { en: "Solar: the study's P50 {p50} MWh a year, uncertainty {sig}% at one sigma ({basis}).", ro: "Solar: P50 din studiu {p50} MWh pe an, incertitudine {sig}% la o sigma ({basis})." },
  a_solar_pvgis: { en: "Solar: the PVGIS yield for the site, {y} kWh per kWp a year{years}, with 14% system losses, less {av}% unavailability and {clip}% clipped by the inverters or the grid limit: P50 {p50} MWh a year. Uncertainty {sig}% at one sigma ({basis}).", ro: "Solar: randamentul PVGIS pentru amplasament, {y} kWh pe kWp pe an{years}, cu pierderi de sistem de 14%, minus {av}% indisponibilitate și {clip}% tăiat de invertoare sau de limita rețelei: P50 {p50} MWh pe an. Incertitudine {sig}% la o sigma ({basis})." },
  a_solar_none: { en: "Solar: no yield yet.", ro: "Solar: încă nu există randament." },
  years_w: { en: ", from the weather of {x}", ro: ", din vremea anilor {x}" },
  sig_study: { en: "from the study", ro: "din studiu" },
  sig_site: { en: "from the site's own year-to-year weather and an itemised budget", ro: "din variația vremii de la an la an a amplasamentului și un buget detaliat" },
  sig_assumed: { en: "an assumed itemised budget", ro: "un buget detaliat presupus" },
  a_p90: { en: "P90 is P50 less 1.2816 sigma, for each source, added up: {p90} MWh a year for the plant against {p50} at P50. Adding each source's own P90 is cautious: wind and sun rarely fall short in the same year.", ro: "P90 este P50 minus 1,2816 sigma, pentru fiecare sursă, adunate: {p90} MWh pe an pentru centrală față de {p50} la P50. Adunarea P90 ale fiecărei surse e prudentă: vântul și soarele rareori lipsesc în același an." },
  a_quotes_energy: { en: "Rooftop quotes ({n}): the PVGIS yield at each address, through the VoltMira quote engine, with 7.1% uncertainty at one sigma.", ro: "Oferte pe acoperiș ({n}): randamentul PVGIS la fiecare adresă, prin motorul de calcul VoltMira, cu o incertitudine de 7,1% la o sigma." },
  unset: { en: "{x} (not set)", ro: "{x} (nesetat)" },
  uncomputed: { en: "{x} (not worked out: no clipping curve for the site yet)", ro: "{x} (necalculat: încă nu există o curbă de tăiere pentru amplasament)" },

  q_losses: { en: "What degradation, availability, curtailment, losses and clipping are assumed?", ro: "Ce degradare, disponibilitate, limitare, pierderi și tăiere sunt presupuse?" },
  a_losses_solar: { en: "Solar panels lose {degr}% a year, and {degr1}% more in the first year. Unavailability {av}%; energy clipped {clip}%.", ro: "Panourile solare pierd {degr}% pe an și încă {degr1}% în primul an. Indisponibilitate {av}%; energie tăiată {clip}%." },
  a_losses_wind: { en: "Wind losses (wake, availability, electrical) are inside the energy figure: {x}.", ro: "Pierderile la vânt (umbră aerodinamică, disponibilitate, electrice) sunt incluse în cifra de energie: {x}." },
  wl_study: { en: "the study's own", ro: "cele din studiu" },
  wl_screen: { en: "{n}% in the screening", ro: "{n}% în estimarea preliminară" },
  a_losses_grid: { en: "Curtailment {curt}% of the energy in the base case, {st}% in the curtailment stress case. Connection line losses {line}%.", ro: "Limitare {curt}% din energie în scenariul de bază, {st}% în testul de stres pentru limitare. Pierderi pe linia de racordare {line}%." },

  q_price: { en: "What price is assumed each year, how is it indexed, what happens after the contract, and in which currency?", ro: "Ce preț se presupune în fiecare an, cum se indexează, ce se întâmplă după contract și în ce monedă?" },
  a_price_contract: { en: "{kind} at {price} EUR/MWh for {years} years, indexed {idx}% a year, paid in {cur}. From year {next} the model assumes {after} EUR/MWh, held flat: an assumption, not a contract. The price stress case lowers it by {drop}%.", ro: "{kind} la {price} EUR/MWh pentru {years} ani, indexat cu {idx}% pe an, plătit în {cur}. Din anul {next} modelul presupune {after} EUR/MWh, constant: o ipoteză, nu un contract. Testul de stres pentru preț îl scade cu {drop}%." },
  a_price_merchant: { en: "Sold on the market at an assumed {price} EUR/MWh, held flat: an assumption, not a contract. The price stress case lowers it by {drop}%.", ro: "Vândut pe piață la un preț presupus de {price} EUR/MWh, constant: o ipoteză, nu un contract. Testul de stres pentru preț îl scade cu {drop}%." },
  a_price_bess: { en: "Storage earns {x} EUR per MW a year for {y} years under its own contract, and nothing is assumed after it.", ro: "Stocarea câștigă {x} EUR pe MW pe an timp de {y} ani prin propriul contract, iar după el nu se presupune nimic." },
  kind_auction: { en: "The auction contract", ro: "Contractul din licitație" },
  kind_ppa: { en: "A power purchase agreement", ro: "Un contract de achiziție a energiei" },
  cur_eur: { en: "EUR", ro: "EUR" },
  cur_local: { en: "the local currency", ro: "moneda locală" },

  q_opex: { en: "What are the operating costs, line by line, and how do they rise?", ro: "Care sunt costurile de operare, pe linii, și cum cresc?" },
  a_opex: { en: "{lines}. All rise with inflation, {infl}% a year. Year 1 total: {tot} EUR.", ro: "{lines}. Toate cresc cu inflația, {infl}% pe an. Total în anul 1: {tot} EUR." },
  op_wind: { en: "wind O&M {x} EUR per kW a year", ro: "mentenanță vânt {x} EUR pe kW pe an" },
  op_solar: { en: "solar O&M {x} EUR per kWp a year", ro: "mentenanță solar {x} EUR pe kWp pe an" },
  op_bess: { en: "storage O&M {x} EUR per kWh a year", ro: "mentenanță stocare {x} EUR pe kWh pe an" },
  op_land: { en: "land lease {x} EUR a year", ro: "arenda terenului {x} EUR pe an" },
  op_ins: { en: "insurance {x}% of capex a year", ro: "asigurare {x}% din capex pe an" },

  q_repl: { en: "Are replacements and reserves provided for?", ro: "Sunt prevăzute înlocuiri și rezerve?" },
  a_inv_set: { en: "Inverters are replaced in year {y} at {eur} EUR per kW AC in today's prices, {tot} EUR in that year after inflation, paid from the cash flow before debt service.", ro: "Invertoarele se înlocuiesc în anul {y} la {eur} EUR pe kW AC la prețurile de azi, {tot} EUR în acel an după inflație, plătiți din fluxul de dinaintea serviciului datoriei." },
  a_inv_none: { en: "No inverter replacement is modelled. Most lenders expect one between years 10 and 15, or an O&M contract that covers it; set it on the plant's costs.", ro: "Nu e modelată nicio înlocuire a invertoarelor. Majoritatea creditorilor așteaptă una între anii 10 și 15 sau un contract de mentenanță care o acoperă; seteaz-o la costurile centralei." },
  a_aug_set: { en: "The battery is augmented in year {y} at {eur} EUR per kWh in today's prices, {tot} EUR in that year after inflation.", ro: "Bateria se completează în anul {y} la {eur} EUR pe kWh la prețurile de azi, {tot} EUR în acel an după inflație." },
  a_aug_none: { en: "No battery augmentation is modelled.", ro: "Nu e modelată nicio completare a bateriei." },
  a_dsra_set: { en: "A debt service reserve of {m} months of the next year's service is funded by the sponsor at commissioning: {eur} EUR.", ro: "O rezervă pentru serviciul datoriei de {m} luni din serviciul anului următor e constituită de sponsor la punerea în funcțiune: {eur} EUR." },
  a_dsra_none: { en: "No debt service reserve is set.", ro: "Nu e setată nicio rezervă pentru serviciul datoriei." },

  q_tax: { en: "How is tax worked out?", ro: "Cum se calculează impozitul?" },
  a_tax: { en: "Corporate income tax {rate}% on the profit after a straight-line depreciation over {life} years of the cost after grant plus the interest during construction, and after the loan's interest. A loss is carried forward against later profits, oldest first, {lapse}. The project's own IRR and NPV use the tax it would pay without the loan. VAT and local taxes are not modelled.", ro: "Impozit pe venit {rate}% pe profitul rămas după o amortizare liniară pe {life} ani a costului după grant plus dobânda din perioada construcției și după dobânda creditului. O pierdere se reportează asupra profiturilor următoare, cele mai vechi întâi, {lapse}. RIR și VAN ale proiectului folosesc impozitul pe care l-ar plăti fără credit. TVA și taxele locale nu sunt modelate." },
  lapse_n: { en: "for {n} years, then it lapses", ro: "timp de {n} ani, apoi expiră" },
  lapse_none: { en: "without a time limit", ro: "fără limită de timp" },
  a_tax_none: { en: "No corporate income tax is charged in this model (rate 0). VAT and local taxes are not modelled.", ro: "În acest model nu se plătește impozit pe venit (cota 0). TVA și taxele locale nu sunt modelate." },

  q_debt: { en: "What is the debt: amount, share, rate, tenor, grace, profile, reserve and fees?", ro: "Care e datoria: suma, ponderea, dobânda, termenul, perioada de grație, profilul, rezerva și comisioanele?" },
  a_debt: { en: "{loan} EUR, {share}% of the cost after grant plus the interest during construction; rate {rate}%{steps}; {tenor} years, {grace} of them interest only; {profile}; arrangement fee {fee}%; interest during construction {idc} EUR over {months} months; in {cur}.", ro: "{loan} EUR, {share}% din costul după grant plus dobânda din perioada construcției; dobândă {rate}%{steps}; {tenor} ani, din care {grace} doar cu dobândă; {profile}; comision de acordare {fee}%; dobânda din perioada construcției {idc} EUR pe {months} luni; în {cur}." },
  steps: { en: " ({x} in the first years)", ro: " ({x} în primii ani)" },
  prof_annuity: { en: "level annuity repayments", ro: "rate anuale egale" },
  prof_sculpted: { en: "repayments sculpted to the base case's cash flow", ro: "rate modelate după fluxul din scenariul de bază" },
  a_debt_none: { en: "No debt is set in this model.", ro: "În acest model nu e setată nicio datorie." },

  q_cover: { en: "What is the debt cover, and which covenants are assumed?", ro: "Care e acoperirea datoriei și ce condiții se presupun?" },
  a_cover: { en: "Lowest DSCR {min} at P50 ({minR} over the repayment years{io}) and {p90} at P90; average over the repayment years {avg}. LLCR {llcr} at P50 and {llcr90} at P90. The loan is sized so that DSCR is at least {t50} at P50 and {t90} at P90: the model's sizing targets, to be replaced by the lender's own covenants.", ro: "DSCR minim {min} la P50 ({minR} în anii de rambursare{io}) și {p90} la P90; media în anii de rambursare {avg}. LLCR {llcr} la P50 și {llcr90} la P90. Creditul e dimensionat astfel încât DSCR să fie cel puțin {t50} la P50 și {t90} la P90: țintele de dimensionare ale modelului, de înlocuit cu condițiile creditorului." },
  io: { en: ", {x} in the interest-only years", ro: ", {x} în anii doar cu dobândă" },

  q_stress: { en: "What happens under stress, and where are the break-evens?", ro: "Ce se întâmplă la stres și unde sunt pragurile?" },
  st_line: { en: "{case}: lowest DSCR {d}, project IRR {irr}", ro: "{case}: DSCR minim {d}, RIR proiect {irr}" },
  hr_energy: { en: "{name}: energy can fall {x}% before the P50 DSCR reaches {t}.", ro: "{name}: energia poate scădea cu {x}% până când DSCR la P50 ajunge la {t}." },
  hr_energy_neg: { en: "{name}: energy must rise {x}% for the P50 DSCR to reach {t}.", ro: "{name}: energia trebuie să crească cu {x}% ca DSCR la P50 să ajungă la {t}." },
  hr_capex: { en: "{name}: capex can rise {x}% before the P50 DSCR reaches {t}.", ro: "{name}: capexul poate crește cu {x}% până când DSCR la P50 ajunge la {t}." },
  hr_capex_neg: { en: "{name}: capex must fall {x}% for the P50 DSCR to reach {t}.", ro: "{name}: capexul trebuie să scadă cu {x}% ca DSCR la P50 să ajungă la {t}." },

  q_steps: { en: "Why does the cash flow step down in some years?", ro: "De ce scade fluxul în anumiți ani?" },
  a_steps_none: { en: "It does not step down: no contract ends, no tax depreciation ends and no replacement falls inside the life.", ro: "Nu scade în trepte: niciun contract nu se încheie, nicio amortizare fiscală nu se termină și nicio înlocuire nu cade în durata de viață." },

  q_su: { en: "What are the sources and uses?", ro: "Care sunt sursele și utilizările?" },
  a_su: { en: "Uses: capex {capex}, interest during construction {idc}, arrangement fee {fee}, debt service reserve {dsra}; total {tu} EUR. Sources: grant {grant}, debt {debt}, sponsor's equity with the fee and the reserve {eq}; total {ts} EUR.", ro: "Utilizări: capex {capex}, dobânda din perioada construcției {idc}, comision de acordare {fee}, rezerva serviciului datoriei {dsra}; total {tu} EUR. Surse: grant {grant}, datorie {debt}, capitalul sponsorului cu comisionul și rezerva {eq}; total {ts} EUR." },

  q_permits: { en: "Where do the permits, the grid connection and the land stand?", ro: "Unde sunt autorizațiile, racordarea la rețea și terenul?" },
  a_permits: { en: "{done} of {total} papers done.", ro: "{done} din {total} acte gata." },
  a_permits_all: { en: "Nothing is missing on the checklist.", ro: "Nu lipsește nimic din listă." },
  a_docs_quotes: { en: "Rooftop quotes: {pct}% of their papers are in the document register.", ro: "Oferte pe acoperiș: {pct}% din acte sunt în registrul de documente." },

  q_es: { en: "What did the environmental and social screening find?", ro: "Ce a arătat evaluarea preliminară de mediu și socială?" },
  a_es: { en: "{answered} of {total} screening questions answered, {flagged} answered no (a concern to follow up). It is a screening against the lenders' standards, not an environmental and social impact assessment.", ro: "Au răspuns {answered} din {total} întrebări, {flagged} cu nu (o problemă de urmărit). E o evaluare preliminară față de standardele creditorilor, nu un studiu de impact de mediu și social." },

  q_war: { en: "Is war or political risk covered?", ro: "Este acoperit riscul de război sau politic?" },
  a_war_base: { en: "The base case carries a war-risk insurance premium of {x}% of capex a year.", ro: "Scenariul de bază include o primă de asigurare de risc de război de {x}% din capex pe an." },
  a_war_none: { en: "No war-risk premium is in the base case.", ro: "Scenariul de bază nu include o primă de risc de război." },
  a_war_stress: { en: "The war-risk stress case adds {x}% of capex a year for the Ukrainian assets.", ro: "Testul de stres pentru riscul de război adaugă {x}% din capex pe an pentru activele din Ucraina." },
  a_war_cover: { en: "Political-risk cover, if the lender requires it, is not modelled; its premium can be entered on the Inputs (war-risk insurance).", ro: "Asigurarea de risc politic, dacă creditorul o cere, nu e modelată; prima ei poate fi introdusă la Inputs (asigurarea de risc de război)." },

  q_decom: { en: "Is decommissioning provided for?", ro: "Este prevăzută dezafectarea?" },
  a_decom: { en: "No. The model runs {h} years and stops: no decommissioning cost and no residual value are counted. If the land lease or a permit requires the site to be restored, add that cost before a credit decision.", ro: "Nu. Modelul rulează {h} ani și se oprește: nu se socotește nici costul dezafectării, nici o valoare reziduală. Dacă arenda terenului sau o autorizație cere refacerea terenului, adaugă acel cost înainte de decizia de creditare." },

  q_who: { en: "Who prepared this, and is it independent?", ro: "Cine a pregătit acest material și este independent?" },
  a_who: { en: "Prepared by {co} with VoltMira on {date}, report ID {rid}. It is the preparer's own model, not an independent engineer's or auditor's review. Every cost and price is the preparer's assumption until a quote, a term sheet or a contract replaces it.", ro: "Pregătit de {co} cu VoltMira la {date}, ID raport {rid}. E modelul celui care l-a pregătit, nu evaluarea unui inginer independent sau a unui auditor. Fiecare cost și preț e ipoteza celui care l-a pregătit până când o ofertă, o fișă de termeni sau un contract o înlocuiește." },

  q_excel: { en: "How was the Excel model checked against the app?", ro: "Cum a fost verificat modelul Excel față de aplicație?" },
  a_excel: { en: "Each plant has a live model built from formulas only: an Inputs sheet, a Model sheet and a Tax sheet. The Checks sheet compares {n} of its results with the app's own (capex, loan, energy, revenue, EBITDA, replacements, tax, CFADS, debt service, DSCR, LLCR, NPV and both IRRs): {ok} of {all} agree within 1 EUR, or 0.000001 for a ratio or a rate. Change an input and the plant's model recalculates.", ro: "Fiecare centrală are un model viu construit doar din formule: o foaie Inputs, o foaie Model și o foaie Tax. Foaia Checks compară {n} dintre rezultatele lui cu cele ale aplicației (capex, credit, energie, venituri, EBITDA, înlocuiri, impozit, CFADS, serviciul datoriei, DSCR, LLCR, VAN și ambele RIR): {ok} din {all} coincid în limita a 1 EUR, sau 0,000001 pentru un raport sau o rată. Schimbi o intrare și modelul centralei se recalculează." },
  a_excel_quotes: { en: "Rooftop quotes ({n}) come from the quote engine and stand on the Asset sheets as yearly values; the Cashflow sheet adds them with formulas.", ro: "Ofertele pe acoperiș ({n}) vin din motorul de calcul și stau pe foile Asset ca valori anuale; foaia Cashflow le adună cu formule." },
};

/** A lender-question text in `lang` (ro or en), with {placeholders} filled. */
export function lt(key, lang = "en", vars = {}) {
  const e = LQ[key];
  const s = e ? e[lang] || e.en : key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
}
