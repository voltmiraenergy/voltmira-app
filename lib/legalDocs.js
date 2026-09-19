// lib/legalDocs.js — the service-contract template, pre-filled with the
// project's and company's own real data (same legal_name/reg_no/legal_address
// fields the proforma invoice already uses — see app/(app)/settings/page.jsx).
//
// A TEMPLATE, not legal advice — same "have a lawyer review" framing as
// docs/PRIVACY_POLICY.md. Deliberately Romanian-only, not run through i18n:
// this is real paperwork a client signs, so an EN/RU version would
// misrepresent what's actually filed. The surrounding UI chrome (buttons,
// tabs, the disclaimer) is localized normally; the document body itself is
// not.
//
// No fabricated legal citations: no specific law article numbers. What's
// here is a plain, standard contract skeleton, left for the installer (and
// their lawyer) to complete.
//
// The Moldovan grid-connection request used to live here too, as a
// VoltMira-authored approximation of what a client should write. It's now a
// real download of Premier Energy Distribution's OWN published PDF, filled
// with real project data at the form's own coordinates instead of retyped —
// see lib/racordarePdf.js.

function fmtDateRo(d) {
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

const BLANK = "________________";

// White-labeling (Team+, see lib/features.js and Settings' "White-labeling"
// section): an installer's own wording, saved on companies.*_template_override,
// gets the SAME real-data substitution the built-in templates below always
// applied — never string concatenation of raw user text with raw client data,
// which is how a stray "{{" in an installer's draft would otherwise print
// literally on a document a client signs. Any {{token}} not in the known list
// (a typo, or a token belonging to the OTHER document) renders as the same
// visible BLANK placeholder used everywhere else here, never a silent drop —
// a blank a human notices beats an invented value they might not.
function renderTemplate(template, tokens) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (m, key) => (key in tokens ? tokens[key] : BLANK));
}

export const CONTRACT_TOKENS = [
  "companyLegalName", "companyAddress", "companyRegNo", "companyIban",
  "clientName", "clientAddress", "systemKw", "price", "currency", "date",
];
export const COMMISSIONING_TOKENS = [
  "companyLegalName", "companyRegNo", "clientName", "clientAddress",
  "systemKw", "batteryLine", "warrantyLine", "date",
];

export function buildServiceContract({
  companyLegalName, companyRegNo, companyAddress, companyIban,
  clientName, clientAddress, systemKw, price, currency = "EUR", templateOverride,
}) {
  const kw = Number(systemKw) > 0 ? Number(systemKw).toFixed(1) : BLANK;
  const priceStr = Number(price) > 0 ? Math.round(Number(price)).toLocaleString("ro-RO") : BLANK;
  const today = fmtDateRo(new Date());
  if (String(templateOverride || "").trim()) {
    return renderTemplate(templateOverride, {
      companyLegalName: companyLegalName || BLANK, companyAddress: companyAddress || BLANK,
      companyRegNo: companyRegNo || BLANK, companyIban: companyIban || BLANK,
      clientName: clientName || BLANK, clientAddress: clientAddress || BLANK,
      systemKw: kw, price: priceStr, currency, date: today,
    });
  }
  return `CONTRACT DE PRESTĂRI SERVICII
Nr. ____ / ${fmtDateRo(new Date())}

PĂRȚILE CONTRACTANTE

PRESTATOR: ${companyLegalName || "[Denumire legală instalator, completează în Setări]"}
Sediu: ${companyAddress || BLANK}
IDNO/CUI: ${companyRegNo || BLANK}
Cont bancar (IBAN): ${companyIban || BLANK}

BENEFICIAR: ${clientName || BLANK}
Adresa instalării: ${clientAddress || BLANK}

Părțile au convenit încheierea prezentului contract, cu respectarea următoarelor clauze:

ART. 1: OBIECTUL CONTRACTULUI
Prestatorul se obligă să proiecteze, să furnizeze echipamentul și să execute lucrările de instalare a unui sistem fotovoltaic cu puterea instalată de ${kw} kWp, la adresa Beneficiarului menționată mai sus, conform ofertei tehnico-comerciale anexate prezentului contract.

ART. 2: PREȚUL ȘI MODALITATEA DE PLATĂ
Valoarea totală a lucrărilor este de ${priceStr} ${currency}, conform ofertei anexate. Modalitatea, avansul și termenele de plată se stabilesc de comun acord între părți, prin act adițional sau prin specificarea lor mai jos.

ART. 3: TERMENUL DE EXECUTARE
Termenul de execuție se stabilește de comun acord între părți, ținând cont de termenele de livrare a echipamentului și de durata procedurii de avizare la operatorul de distribuție.

ART. 4: GARANȚII
Garanțiile aplicabile echipamentelor și lucrării de instalare sunt cele menționate în oferta tehnico-comercială anexată prezentului contract.

ART. 5: OBLIGAȚIILE PĂRȚILOR
Prestatorul răspunde de calitatea lucrărilor executate și de conformitatea instalației cu normativele tehnice în vigoare. Beneficiarul se obligă să asigure accesul la locul instalării și să achite prețul convenit la termenele stabilite.

ART. 6: DISPOZIȚII FINALE
Prezentul contract se completează cu prevederile legislației civile în vigoare a Republicii Moldova. Orice modificare a prezentului contract se face în scris, prin acordul ambelor părți.

PRESTATOR,                                          BENEFICIAR,
${companyLegalName || BLANK}                          ${clientName || BLANK}

_________________                                    _________________
(semnătură)                                           (semnătură)`;
}

// A real installer practice (confirmed: this is countersigned between
// installer/client/network operator, not a fixed government form — unlike
// the racordare request above, no official template exists to reproduce).
// This is a VoltMira-authored attestation, same status as the service
// contract: a starting template, not a stamped legal document.
export function buildCommissioningAct({
  companyLegalName, companyRegNo, clientName, clientAddress,
  systemKw, hasBattery, battKwh, warrantyYears, templateOverride,
}) {
  const kw = Number(systemKw) > 0 ? Number(systemKw).toFixed(1) : BLANK;
  const today = fmtDateRo(new Date());
  const battLine = hasBattery
    ? `- Instalație de stocare: ${Number(battKwh) > 0 ? Number(battKwh).toFixed(1) : BLANK} kWh\n`
    : "";
  const warrantyLine = Number(warrantyYears) > 0
    ? `Garanția pentru manopera de instalare, de ${Number(warrantyYears)} ani, începe de la data prezentului act.`
    : `Garanția pentru manopera de instalare începe de la data prezentului act, conform ofertei acceptate.`;
  if (String(templateOverride || "").trim()) {
    return renderTemplate(templateOverride, {
      companyLegalName: companyLegalName || BLANK, companyRegNo: companyRegNo || BLANK,
      clientName: clientName || BLANK, clientAddress: clientAddress || BLANK,
      systemKw: kw, batteryLine: battLine.trim(), warrantyLine, date: today,
    });
  }
  return `ACT DE DARE ÎN EXPLOATARE
Nr. ____ / ${today}

Încheiat astăzi, ${today}, între:

PRESTATOR (instalator): ${companyLegalName || "[Denumire legală instalator, completează în Setări]"}${companyRegNo ? ` (IDNO/CUI: ${companyRegNo})` : ""}

BENEFICIAR (client): ${clientName || BLANK}
Adresa instalației: ${clientAddress || BLANK}

Prin prezentul act se confirmă că sistemul fotovoltaic descris mai jos a fost instalat, testat și pus în funcțiune la adresa de mai sus:

- Puterea instalată: ${kw} kWp
${battLine}- Data punerii în funcțiune: ${today}

CONSTATĂRI:
1. Instalația electrică a sistemului a fost verificată și corespunde normativelor tehnice în vigoare.
2. Sistemul funcționează conform parametrilor din oferta tehnico-comercială acceptată de Beneficiar.
3. Beneficiarul a fost instruit cu privire la funcționarea de bază și la măsurile de siguranță ale instalației.
4. ${warrantyLine}

Prezentul act se semnează în două exemplare, câte unul pentru fiecare parte, și rămâne anexă la contractul de prestări servicii încheiat între părți.

PRESTATOR,                                          BENEFICIAR,
${companyLegalName || BLANK}                          ${clientName || BLANK}

_________________                                    _________________
(semnătură)                                           (semnătură)`;
}
