// lib/legalDocs.js — editable paperwork templates, pre-filled with the
// project's and company's own real data (same legal_name/reg_no/legal_address
// fields the proforma invoice already uses — see app/(app)/settings/page.jsx).
//
// TEMPLATES, not legal advice — same "have a lawyer review" framing as
// docs/PRIVACY_POLICY.md. Deliberately Romanian-only, not run through i18n:
// this is real paperwork a client signs and an operator (Premier Energy/RED
// Nord) receives, so an EN/RU version would misrepresent what's actually
// filed. The surrounding UI chrome (buttons, tabs, the disclaimer) is
// localized normally; the document body itself is not.
//
// No fabricated legal citations: no specific law article numbers, no claimed
// ANRE form IDs — anything that specific would need real verification this
// file doesn't have. What's here is a plain, standard contract/request
// skeleton, left for the installer (and their lawyer) to complete.

function fmtDateRo(d) {
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

const BLANK = "________________";

export function buildServiceContract({
  companyLegalName, companyRegNo, companyAddress, companyIban,
  clientName, clientAddress, systemKw, price, currency = "EUR",
}) {
  const kw = Number(systemKw) > 0 ? Number(systemKw).toFixed(1) : BLANK;
  const priceStr = Number(price) > 0 ? Math.round(Number(price)).toLocaleString("ro-RO") : BLANK;
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

export function buildConnectionRequest({
  companyLegalName, companyRegNo, clientName, clientAddress, systemKw, hasBattery,
}) {
  const kw = Number(systemKw) > 0 ? Number(systemKw).toFixed(1) : BLANK;
  return `CERERE
privind eliberarea avizului de racordare pentru o instalație de producere a energiei electrice din surse regenerabile (prosumator)

Către: [se completează operatorul de distribuție competent pe rază, Premier Energy Distribution sau RED Nord]
Data: ${fmtDateRo(new Date())}

Subsemnatul/Subscrisa ${clientName || BLANK}, cu domiciliul/sediul la adresa ${clientAddress || BLANK},

solicit eliberarea avizului de racordare pentru instalația de producere a energiei electrice din sursă regenerabilă (fotovoltaică) cu următoarele caracteristici:

- Puterea instalată: ${kw} kWp
- Regim de funcționare: ${hasBattery ? "cu stocare (baterie)" : "fără stocare"}
- Regim comercial solicitat: prosumator, cu facturare netă (net billing)

Instalația va fi proiectată și executată de ${companyLegalName || "[instalator, completează în Setări]"}${companyRegNo ? ` (IDNO/CUI: ${companyRegNo})` : ""}, cu respectarea normativelor tehnice în vigoare.

Anexez prezentei cereri documentația tehnică a instalației (schema electrică monofilară, memoriul de calcul, buletinul de măsurători, după caz).

Solicitant,
_________________
(semnătură)`;
}
