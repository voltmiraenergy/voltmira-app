// lib/gridSubmission.js — sending a quote's grid-connection file to the
// operator and following it (docs/INTEGRATIONS.md). Pure, apart from the
// adapters' I/O.
//
// Before anything is sent, the package is checked: the applicant details the
// operator's form asks for (lib/gridDetails.js gridMissing) and the documents
// on the operator's checklist. Each item is either made by VoltMira (the
// filled application form) or one the installer confirms is attached.
//
// The checklist follows the documents the operators' own application forms
// list. An operator may ask for more for a given site; the docs say so, and
// the list is code, so a change is one edit here.
//
// Statuses: submitted -> docs_requested -> submitted (sent again with them)
//           submitted -> approved -> connected; any open one -> rejected.
// Each status also ticks the matching stage of the grid file (lib/mdGrid.js).
import crypto from "node:crypto";

const N = (en, ro, ru, uk) => ({ en, ro, ru, uk });

/** The documents each operator's application asks for. auto: VoltMira makes it. */
export const OPERATOR_CHECKLIST = {
  premier: [
    { id: "application", auto: true, name: N("Application for the connection approval (filled)", "Cererea pentru avizul de racordare (completată)", "Заявление на разрешение на подключение (заполнено)", "Заява на дозвіл на приєднання (заповнена)") },
    { id: "id_copy", auto: false, name: N("Copy of the applicant's ID (or company registration)", "Copia actului de identitate (sau a certificatului de înregistrare)", "Копия удостоверения личности (или свидетельства о регистрации)", "Копія посвідчення особи (або свідоцтва про реєстрацію)") },
    { id: "property", auto: false, name: N("Proof of ownership or use of the site (real estate register extract)", "Dovada dreptului asupra imobilului (extras din Registrul bunurilor imobile)", "Подтверждение права на объект (выписка из реестра недвижимости)", "Підтвердження права на об’єкт (витяг з реєстру нерухомості)") },
    { id: "single_line", auto: false, name: N("Single-line diagram of the installation", "Schema monofilară a instalației", "Однолинейная схема установки", "Однолінійна схема установки") },
    { id: "equipment", auto: false, name: N("Inverter and panel data sheets / certificates", "Fișele tehnice și certificatele invertorului și panourilor", "Технические паспорта и сертификаты инвертора и панелей", "Технічні паспорти та сертифікати інвертора і панелей") },
    { id: "authorization", auto: false, optional: true, name: N("Power of attorney, if a representative applies", "Procura, dacă depune un reprezentant", "Доверенность, если подаёт представитель", "Довіреність, якщо подає представник") },
  ],
  rednord: [
    { id: "application", auto: true, name: N("Application for the connection approval (filled)", "Cererea pentru avizul de racordare (completată)", "Заявление на разрешение на подключение (заполнено)", "Заява на дозвіл на приєднання (заповнена)") },
    { id: "id_copy", auto: false, name: N("Copy of the applicant's ID (or company registration)", "Copia actului de identitate (sau a certificatului de înregistrare)", "Копия удостоверения личности (или свидетельства о регистрации)", "Копія посвідчення особи (або свідоцтва про реєстрацію)") },
    { id: "property", auto: false, name: N("Proof of ownership or use of the site (real estate register extract)", "Dovada dreptului asupra imobilului (extras din Registrul bunurilor imobile)", "Подтверждение права на объект (выписка из реестра недвижимости)", "Підтвердження права на об’єкт (витяг з реєстру нерухомості)") },
    { id: "site_plan", auto: false, name: N("Site plan with the connection point", "Planul de situație cu punctul de racordare", "Ситуационный план с точкой подключения", "Ситуаційний план з точкою приєднання") },
    { id: "single_line", auto: false, name: N("Single-line diagram of the installation", "Schema monofilară a instalației", "Однолинейная схема установки", "Однолінійна схема установки") },
    { id: "equipment", auto: false, name: N("Inverter and panel data sheets / certificates", "Fișele tehnice și certificatele invertorului și panourilor", "Технические паспорта и сертификаты инвертора и панелей", "Технічні паспорти та сертифікати інвертора і панелей") },
    { id: "authorization", auto: false, optional: true, name: N("Power of attorney, if a representative applies", "Procura, dacă depune un reprezentant", "Доверенность, если подаёт представитель", "Довіреність, якщо подає представник") },
  ],
};

/**
 * Is the package complete?
 * @param {object} a
 * @param {string} a.operator
 * @param {string[]} a.missingDetails  gridMissing(applicant): fields the form still lacks
 * @param {string[]} a.attached        ids the installer confirms are attached
 * @param {boolean} [a.representative] the applicant is represented (the power of attorney becomes required)
 * @returns {{ complete: boolean, missingDetails: string[], missingDocs: string[], checklist: object[] }}
 */
export function checkPackage({ operator, missingDetails = [], attached = [], representative = false }) {
  const list = OPERATOR_CHECKLIST[operator] || [];
  const has = new Set(attached);
  const checklist = list.map((d) => {
    const required = !d.optional || (d.id === "authorization" && representative);
    return { id: d.id, auto: !!d.auto, required, present: d.auto || has.has(d.id) };
  });
  const missingDocs = checklist.filter((c) => c.required && !c.present).map((c) => c.id);
  return { complete: !missingDetails.length && !missingDocs.length && list.length > 0, missingDetails, missingDocs, checklist };
}

export const GRID_STATUSES = ["submitted", "docs_requested", "approved", "connected", "rejected"];
const NEXT = { submitted: ["docs_requested", "approved", "rejected"], docs_requested: ["submitted", "rejected"], approved: ["connected", "rejected"], connected: [], rejected: [] };
export const gridNext = (from) => NEXT[from] || [];

export function nextGridStatus(from, to) {
  if (!GRID_STATUSES.includes(to)) return { ok: false, error: "unknown_status" };
  if (from === to) return { ok: true, same: true };
  return gridNext(from).includes(to) ? { ok: true } : { ok: false, error: "bad_transition" };
}

/** The grid-file stage a status ticks (lib/mdGrid.js GRID_STAGES), or null. */
export const STAGE_FOR = { submitted: "applied", approved: "approval", connected: "meter" };

/** A tracked reference: operator, date, random. "VM-P-261018-7F3A" */
export function newGridReference(operator, date = new Date()) {
  const d = date.toISOString().slice(2, 10).replace(/-/g, "");
  return `VM-${operator === "rednord" ? "R" : "P"}-${d}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

/**
 * The operator is reached through submit(package) ->
 *   { ok: true, channel } | { ok: false, error, retryable }
 * mock: records the submission only (nothing leaves VoltMira; the card says so).
 * email: the package to the operator's address (env GRID_EMAIL_PREMIER,
 *   GRID_EMAIL_REDNORD) with the filled form attached and the reference in
 *   the subject, so a reply can be matched.
 */
export function gridMockAdapter() {
  return { id: "mock", async submit() { return { ok: true, channel: "mock" }; } };
}

export function gridEmailAdapter({ sendEmail, emailConfigured, to }) {
  return {
    id: "email",
    async submit(pkg) {
      if (!to) return { ok: false, error: "no_operator_email", retryable: false };
      if (!emailConfigured()) return { ok: false, error: "email_not_configured", retryable: false };
      const r = await sendEmail({ to, subject: pkg.subject, html: pkg.html, attachments: pkg.attachments, replyTo: pkg.replyTo });
      return r?.sent ? { ok: true, channel: "email" } : { ok: false, error: r?.error || "email_not_sent", retryable: true };
    },
  };
}

export function gridAdapterFor(operator, io, env = process.env) {
  const to = operator === "rednord" ? env.GRID_EMAIL_REDNORD : env.GRID_EMAIL_PREMIER;
  return to ? gridEmailAdapter({ ...io, to }) : gridMockAdapter();
}
