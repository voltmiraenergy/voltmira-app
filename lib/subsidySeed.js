// lib/subsidySeed.js — version 1 of the support programmes, in code: the four
// Moldovan programmes the installer's support card has shown since 2026-10-03
// (lib/greenData.js PROGRAMS, the Ministry of Energy's MBW 2026 slides), in the
// shape of the subsidy_programs table. Used until
// supabase/add-tariffs-subsidies.sql has run; the SQL seeds the same rows.
// Casa Verde is deliberately absent (the user's decision).
//
// Required documents follow from each programme's own conditions (a VAT
// payer needs the VAT registration, a net-metering condition needs the
// net-metering contract, a loan guarantee needs the loan). The programme's
// official list may ask for more: docs/TARIFFS_AND_SUBSIDIES.md says so.

const DOC = {
  vat_registration: { en: "VAT payer registration", ro: "Înregistrarea ca plătitor de TVA", ru: "Регистрация плательщика НДС", uk: "Реєстрація платника ПДВ" },
  battery_invoice: { en: "Invoice for the battery, with VAT", ro: "Factura pentru baterie, cu TVA", ru: "Счёт за батарею с НДС", uk: "Рахунок за батарею з ПДВ" },
  net_metering_contract: { en: "Net-metering contract with the operator", ro: "Contractul de net-metering cu operatorul", ru: "Договор нет-метеринга с оператором", uk: "Договір нет-метерингу з оператором" },
  loan_agreement: { en: "Loan agreement for the battery", ro: "Contractul de credit pentru baterie", ru: "Кредитный договор на батарею", uk: "Кредитний договір на батарею" },
};
const docs = (...ids) => ids.map((id) => ({ id, name: DOC[id] }));

export const SUBSIDY_SEED = [
  {
    id: "seed-law112_vat-1", code: "law112_vat", version: 1, market: "MD", kind: "tax",
    name: { en: "VAT refund on the battery", ro: "Rambursarea TVA la baterie", ru: "Возврат НДС за батарею", uk: "Повернення ПДВ за батарею" },
    provider: "Legea nr. 112/2026",
    eligibility: { clientKinds: ["sme", "company"], requiresBattery: true, vatPayer: true },
    estimate: { type: "vat_in_battery" },
    required_documents: docs("vat_registration", "battery_invoice"),
    valid_from: "2026-06-11", valid_to: null, active: true, source_url: "", created_by: "seed",
  },
  {
    id: "seed-law112_customs-1", code: "law112_customs", version: 1, market: "MD", kind: "duty",
    name: { en: "0% customs duty on batteries", ro: "Taxă vamală 0% la baterii", ru: "Пошлина 0% на батареи", uk: "Мито 0% на батареї" },
    provider: "Legea nr. 112/2026",
    eligibility: { clientKinds: ["household", "sme", "company"], requiresBattery: true },
    estimate: { type: "info", fromPct: 8, toPct: 0 },
    required_documents: [],
    valid_from: "2026-06-11", valid_to: null, active: true, source_url: "", created_by: "seed",
  },
  {
    id: "seed-facem_373-1", code: "facem_373", version: 1, market: "MD", kind: "grant",
    name: { en: "FACEM, programme 373", ro: "FACEM, programul 373", ru: "FACEM, программа 373", uk: "FACEM, програма 373" },
    provider: "FACEM, programul 373",
    eligibility: { clientKinds: ["sme"], requiresBattery: true, netMetering: true },
    estimate: { type: "pct_of", base: "battery", pct: 30, upTo: true },
    required_documents: docs("net_metering_contract", "battery_invoice"),
    valid_from: null, valid_to: null, active: true, source_url: "", created_by: "seed",
  },
  {
    id: "seed-bess_guarantee-1", code: "bess_guarantee", version: 1, market: "MD", kind: "guarantee",
    name: { en: "State guarantee on the battery loan", ro: "Garanția statului la creditul pentru baterie", ru: "Госгарантия по кредиту на батарею", uk: "Державна гарантія за кредитом на батарею" },
    provider: "Garanția de stat pentru stocarea energiei",
    eligibility: { clientKinds: ["sme", "company"], requiresBattery: true, loan: true },
    estimate: { type: "pct_of", base: "loan", pct: 50, capMinor: 3000000000, currency: "MDL", feePctYear: 1, maxMonths: 120 },
    required_documents: docs("loan_agreement"),
    valid_from: null, valid_to: "2028-12-31", active: true,
    source_url: "https://www.moldpres.md/rom/economie/republica-moldova-va-dezvolta-un-instrument-de-garantare-a-creditelor-pentru-investitiile-in-sisteme-de-stocare-a-energiei",
    created_by: "seed",
  },
];
