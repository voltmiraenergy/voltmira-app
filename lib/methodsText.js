// lib/methodsText.js — the methods appendix and the glossary of the bank
// documents, in English and Romanian (formal, as the bank documents are).
// Russian and Ukrainian readers get the English text. Each sentence says what
// the model does, so a credit officer can follow a figure back to its rule:
// keep this in step with lib/plantFinance.js, lib/projectFinance.js,
// lib/debtSizing.js, lib/p90Budget.js and lib/clipping.js. Pure.

const pick = (o, lang) => (lang === "ro" ? o.ro : o.en);

const TITLE = { en: "Methods and glossary", ro: "Metode și glosar" };
const METHODS_H = { en: "How the figures are built", ro: "Cum sunt construite cifrele" };
const GLOSSARY_H = { en: "Glossary", ro: "Glosar" };
const NOTE = {
  en: "These notes describe the model that produced the figures in this document. Where a study or a datasheet is cited, it governs the figure it states.",
  ro: "Aceste note descriu modelul care a produs cifrele din acest document. Acolo unde este citat un studiu sau o fișă tehnică, acestea prevalează asupra cifrei pe care o prezintă.",
};

/** How the figures are built, one short paragraph each. */
export const METHODS = [
  {
    h: { en: "Energy", ro: "Energia" },
    p: {
      en: "Solar energy is the PVGIS yield for the site at the design tilt and azimuth, with 14% system losses, less the plant's unavailability and the energy clipped by the inverters or the grid limit; the first-year extra degradation and the yearly rate then lower it over the plant's life. Wind energy is a screening from public wind data at hub height. A study's own P50 replaces either estimate and is never reduced a second time.",
      ro: "Energia solară este randamentul PVGIS pentru amplasament la înclinarea și azimutul de proiect, cu pierderi de sistem de 14%, minus indisponibilitatea centralei și energia tăiată de invertoare sau de limita rețelei; degradarea suplimentară din primul an și rata anuală o reduc apoi pe durata de viață. Energia eoliană este o estimare orientativă din date publice despre vânt la înălțimea butucului. P50 dintr-un studiu înlocuiește oricare estimare și nu este redus a doua oară.",
    },
  },
  {
    h: { en: "P90 and the uncertainty", ro: "P90 și incertitudinea" },
    p: {
      en: "P90 is the P50 less 1.2816 times the uncertainty sigma. For solar, sigma is the root of the sum of the squares of seven parts: the irradiance database, the year-to-year weather (PVGIS's own standard deviation at the site), the model, soiling, availability, shading and light-induced degradation. The table in the plant section marks each part as measured at the site or assumed. A study's own P50 and P90 set sigma instead.",
      ro: "P90 este P50 minus 1,2816 ori incertitudinea sigma. Pentru solar, sigma este rădăcina sumei pătratelor a șapte componente: baza de date de iradiere, vremea de la un an la altul (abaterea standard PVGIS pentru amplasament), modelul, murdărirea, disponibilitatea, umbrirea și degradarea indusă de lumină. Tabelul din secțiunea centralei marchează fiecare componentă ca măsurată la amplasament sau presupusă. P50 și P90 dintr-un studiu stabilesc sigma în locul lor.",
    },
  },
  {
    h: { en: "Revenue, costs and cash flow", ro: "Venituri, costuri și flux de numerar" },
    p: {
      en: "Revenue is the energy times the contract price, indexed as stated, and after the contract ends an assumed price held flat. Operating costs rise with inflation. They are deducted, with the war-risk cover where set, and so is the corporate income tax: tax is charged on profit after a straight-line depreciation over the tax life (of the cost after grants plus the interest during construction) and after the loan's interest, with losses carried forward, oldest first, for the years the law allows. Replacements set by the developer (the inverters, a battery's augmentation, and for rooftop quotes the portfolio's inverter replacement) are taken in the year they fall, at today's price raised by inflation, with no tax relief. What is left is the cash flow available for debt service. At the end of the life, a decommissioning cost and a value left, each a share of capex raised by inflation, enter the project's and the sponsor's cash flows in the last year, untaxed.",
      ro: "Veniturile sunt energia înmulțită cu prețul din contract, indexat conform declarației, iar după încheierea contractului un preț presupus, ținut constant. Costurile de operare cresc cu inflația. Ele se scad, împreună cu asigurarea riscului de război acolo unde este setată, precum și impozitul pe venit: impozitul se calculează pe profitul după o amortizare liniară pe durata fiscală (a costului după granturi plus dobânda din perioada construcției) și după dobânda creditului, cu pierderile reportate, cele mai vechi întâi, pentru anii permiși de lege. Înlocuirile stabilite de dezvoltator (invertoarele, completarea unei baterii și, pentru ofertele pe acoperiș, înlocuirea invertorului stabilită pentru portofoliu) se scad în anul în care cad, la prețul de azi crescut cu inflația, fără deducere fiscală. Ce rămâne este fluxul de numerar disponibil pentru serviciul datoriei. La sfârșitul duratei de viață, un cost de dezafectare și o valoare rămasă, fiecare ca parte din capex crescută cu inflația, intră în fluxurile proiectului și ale sponsorului în ultimul an, neimpozitate.",
    },
  },
  {
    h: { en: "Loan, sizing and cover", ro: "Credit, dimensionare și acoperire" },
    p: {
      en: "The loan is drawn evenly over the construction months, and the interest on it is added to the loan. After commissioning, any interest-only years pay interest alone; the principal is then repaid either in level instalments (an annuity, with the stepped rate where one applies) or sculpted to the base case's cash flow, a shape fixed at financial close that a stress case does not reshape. The cover of each year is the cash flow available divided by that year's debt service: the lowest cover is read over the repayment years, with the interest-only years shown apart, and the average over the repayment years. The LLCR discounts the cash flow over the loan's life at the loan's own rates. The largest supportable loan is the lowest of three limits: the loan that keeps the lowest cover at the P50 target, the loan that keeps it at the P90 target (usually 1.30x and 1.20x; both editable), and the gearing cap. The debt service reserve is held in months of the next year's debt service.",
      ro: "Creditul se trage uniform pe lunile de construcție, iar dobânda aferentă se adaugă la credit. După punerea în funcțiune, eventualii ani doar cu dobândă plătesc numai dobânda; principalul se rambursează apoi fie în rate egale (o anuitate, cu rata în trepte acolo unde se aplică), fie modelat după fluxul din scenariul de bază, o formă fixată la închiderea finanțării pe care un test de stres nu o schimbă. Acoperirea fiecărui an este fluxul de numerar disponibil împărțit la serviciul datoriei din acel an: acoperirea minimă se citește pe anii de rambursare, cu anii doar cu dobândă arătați separat, iar media pe anii de rambursare. LLCR actualizează fluxul pe durata creditului la ratele proprii ale creditului. Cel mai mare credit suportabil este cel mai mic dintre trei plafoane: creditul care menține cea mai slabă acoperire la ținta P50, creditul care o menține la ținta P90 (de obicei 1,30x și 1,20x; ambele modificabile) și plafonul de îndatorare. Rezerva pentru serviciul datoriei se constituie în luni din serviciul datoriei al anului următor.",
    },
  },
  {
    h: { en: "Stress, replay and seasons", ro: "Stres, reluare și anotimpuri" },
    p: {
      en: "The stress table re-runs the same model with a lower yield (P90), a lower price, a price that does not rise (an indexed contract held at no rise), curtailment, a late start, a weaker local currency, higher capex and an interest rate two points higher, one at a time, then the worst of them combined. The weather replay runs the loan on each year of PVGIS's record at the site, with the sun of that year standing in for the yield. The seasonal cover splits the weakest loan year into months by the site's monthly yield and sets the cash needed to carry the lean months against the debt service reserve.",
      ro: "Tabelul de stres reia același model cu un randament mai mic (P90), un preț mai mic, un preț care nu crește (un contract indexat ținut fără creștere), limitarea rețelei, o pornire întârziată, o monedă locală mai slabă, un capex mai mare și o dobândă cu două puncte mai mare, pe rând, apoi cele mai rele combinate. Reluarea vremii rulează creditul pe fiecare an din seria PVGIS pentru amplasament, soarele acelui an ținând locul randamentului. Acoperirea pe anotimpuri împarte cel mai slab an al creditului pe luni după randamentul lunar al amplasamentului și compară numerarul necesar pentru lunile slabe cu rezerva pentru serviciul datoriei.",
    },
  },
  {
    h: { en: "Export limit and clipping", ro: "Limita de export și tăierea vârfurilor" },
    p: {
      en: "The limit is the lower of the inverters' AC power and the power approved at the connection point, less the wind's average output where wind shares the connection. The clipped share is read from one weather year of PVGIS hourly values at the limit per kWp of panels; it is held constant over the life, which errs on the cautious side because ageing lowers it.",
      ro: "Limita este cea mai mică dintre puterea AC a invertoarelor și puterea aprobată în punctul de racordare, minus puterea medie a vântului acolo unde vântul folosește același racord. Partea tăiată este citită din valorile orare PVGIS pentru un an meteo, la limita pe kWp de panouri; este păstrată constantă pe durata de viață, ceea ce este prudent deoarece îmbătrânirea o reduce.",
    },
  },
  {
    h: { en: "Equipment, site and climate", ro: "Echipamente, amplasament și climă" },
    p: {
      en: "Equipment, counts, ratings and warranties are the developer's, from the datasheets and the design; their totals are checked against the declared capacity. Elevation and horizon come from PVGIS's terrain model; temperature, wind and snow from NASA POWER's daily series over twenty years. These are screening values for design loads, insurance and climate-risk screening, not design values.",
      ro: "Echipamentele, numerele, puterile și garanțiile sunt ale dezvoltatorului, din fișele tehnice și din proiect; totalurile lor sunt comparate cu puterea declarată. Altitudinea și orizontul provin din modelul de teren PVGIS; temperatura, vântul și zăpada din seria zilnică NASA POWER pe douăzeci de ani. Acestea sunt valori orientative pentru încărcările de proiectare, asigurare și evaluarea riscului climatic, nu valori de proiectare.",
    },
  },
  {
    h: { en: "The spreadsheet", ro: "Foaia de calcul" },
    p: {
      en: "The Excel model rebuilds each plant from its inputs with formulas only: energy, prices, revenue, costs, replacements, the loan, the tax losses, the cover, the reserve and the returns. Its Checks sheet compares each result with the app's own, to the euro, so the spreadsheet and this document cannot silently differ. Rooftop quotes enter as yearly values from the quote engine.",
      ro: "Modelul Excel reconstruiește fiecare centrală din datele de intrare doar cu formule: energia, prețurile, veniturile, costurile, înlocuirile, creditul, pierderile fiscale, acoperirea, rezerva și randamentele. Foaia Checks compară fiecare rezultat cu cel al aplicației, la euro, astfel încât foaia de calcul și acest document nu pot diferi fără să se vadă. Ofertele pe acoperiș intră ca valori anuale din motorul de calcul.",
    },
  },
  {
    h: { en: "Integrity of this document", ro: "Integritatea acestui document" },
    p: {
      en: "The report ID is a SHA-256 fingerprint of the document's key figures. The manifests of the bank pack and the data room list the SHA-256 of every file, so a changed figure or file can be seen.",
      ro: "Identificatorul raportului este o amprentă SHA-256 a cifrelor-cheie ale documentului. Manifestele pachetului pentru bancă și ale camerei de date listează SHA-256 al fiecărui fișier, astfel încât o cifră sau un fișier modificat poate fi observat.",
    },
  },
];

/** The terms a credit officer meets in the document. */
export const GLOSSARY = [
  { t: { en: "P50", ro: "P50" }, d: { en: "The yearly energy reached or exceeded in half of all years.", ro: "Energia anuală atinsă sau depășită în jumătate din ani." } },
  { t: { en: "P90", ro: "P90" }, d: { en: "The yearly energy reached or exceeded in nine years out of ten: the P50 less 1.2816 times the uncertainty.", ro: "Energia anuală atinsă sau depășită în nouă ani din zece: P50 minus 1,2816 ori incertitudinea." } },
  { t: { en: "CFADS", ro: "CFADS" }, d: { en: "Cash flow available for debt service: revenue less operating costs and tax, before interest and principal.", ro: "Fluxul de numerar disponibil pentru serviciul datoriei: venituri minus costuri de operare și impozit, înainte de dobândă și rambursare." } },
  { t: { en: "DSCR", ro: "DSCR" }, d: { en: "Debt service cover ratio: the cash flow available divided by the year's interest and principal. The tables show the lowest year and the average over the repayment years.", ro: "Rata de acoperire a serviciului datoriei: fluxul disponibil împărțit la dobânda și rambursarea anului. Tabelele arată cel mai slab an și media pe anii de rambursare." } },
  { t: { en: "LLCR", ro: "LLCR" }, d: { en: "Loan life cover ratio: the present value of the cash flow available over the loan's life, at the loan rate, divided by the loan.", ro: "Rata de acoperire pe durata creditului: valoarea actualizată a fluxului disponibil pe durata creditului, la rata creditului, împărțită la credit." } },
  { t: { en: "DSRA", ro: "DSRA" }, d: { en: "Debt service reserve account: cash held to pay instalments if a year or a season falls short, set in months of debt service.", ro: "Contul de rezervă pentru serviciul datoriei: numerar ținut pentru plata ratelor dacă un an sau un anotimp nu ajunge, stabilit în luni de serviciu al datoriei." } },
  { t: { en: "Gearing", ro: "Îndatorare" }, d: { en: "The loan as a share of the cost after grants, interest during construction included.", ro: "Creditul ca pondere din costul după granturi, inclusiv dobânda din construcție." } },
  { t: { en: "DC/AC ratio", ro: "Raport DC/AC" }, d: { en: "The panels' DC power divided by the inverters' AC power.", ro: "Puterea DC a panourilor împărțită la puterea AC a invertoarelor." } },
  { t: { en: "Clipping", ro: "Tăierea vârfurilor" }, d: { en: "Energy that is not delivered because the inverters or the grid approval limit the power at that hour.", ro: "Energia care nu este livrată deoarece invertoarele sau aprobarea de racordare limitează puterea în acea oră." } },
  { t: { en: "Capacity factor", ro: "Factor de capacitate" }, d: { en: "The yearly energy divided by the capacity times 8,760 hours.", ro: "Energia anuală împărțită la puterea instalată înmulțită cu 8.760 de ore." } },
  { t: { en: "LCOE", ro: "LCOE" }, d: { en: "Levelised cost of energy: the present value of the capital and operating costs per MWh produced, on the cost before grants.", ro: "Costul nivelat al energiei: valoarea actualizată a costurilor de capital și de operare pe MWh produs, pe costul înainte de granturi." } },
  { t: { en: "Project and equity IRR", ro: "IRR de proiect și pe capital propriu" }, d: { en: "The yearly return on all the capital put in, and on the equity alone after the debt's cash flows.", ro: "Randamentul anual al întregului capital investit și al capitalului propriu singur, după fluxurile creditului." } },
  { t: { en: "Degradation", ro: "Degradare" }, d: { en: "The yearly loss of module output, with the extra loss of the first year (light-induced).", ro: "Pierderea anuală a producției modulelor, cu pierderea suplimentară din primul an (indusă de lumină)." } },
  { t: { en: "ATR", ro: "ATR" }, d: { en: "The grid operator's technical approval for connection, which states the power that may be sent out.", ro: "Avizul tehnic de racordare al operatorului de rețea, care stabilește puterea ce poate fi livrată." } },
];

/** @param {string} lang @returns {{ title:string, methodsH:string, glossaryH:string, note:string, methods:{h:string,p:string}[], glossary:{t:string,d:string}[] }} */
export function methodsAppendix(lang = "en") {
  return {
    title: pick(TITLE, lang), methodsH: pick(METHODS_H, lang), glossaryH: pick(GLOSSARY_H, lang), note: pick(NOTE, lang),
    methods: METHODS.map((m) => ({ h: pick(m.h, lang), p: pick(m.p, lang) })),
    glossary: GLOSSARY.map((g) => ({ t: pick(g.t, lang), d: pick(g.d, lang) })),
  };
}
