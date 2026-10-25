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
//           submitted -> approved -> meter_installed -> connected (the meter
//           step may be skipped); any open one -> rejected.
// What is asked for comes from the operator's rules (lib/gridRules.js) when the caller passes them.
// Each status also ticks the matching stage of the grid file (lib/mdGrid.js).
import crypto from "node:crypto";
import { powerIssues } from "./gridPower.js";
import { docAge } from "./gridRules.js";

const N = (en, ro, ru, uk) => ({ en, ro, ru, uk });

/**
 * Every document a file can hold. The first group is what the application asks for; the legacy ones
 * were on an earlier checklist and stay named so a package already sent can still be listed.
 */
const DOC = {
  application: { auto: true, name: N("Application for the connection approval (filled)", "Cererea pentru avizul de racordare (completată)", "Заявление на разрешение на подключение (заполнено)", "Заява на дозвіл на приєднання (заповнена)") },
  signed: { name: N("The application signed by the applicant (an electronic signature is required for a company filing online)", "Cererea semnată de solicitant (semnătura electronică este obligatorie pentru persoanele juridice la depunerea online)", "Заявление, подписанное заявителем (для юридических лиц при подаче онлайн нужна электронная подпись)", "Заява, підписана заявником (для юридичних осіб при поданні онлайн потрібен електронний підпис)") },
  id_copy: { name: N("Copy of the applicant's identity card", "Copia buletinului de identitate al solicitantului", "Копия удостоверения личности заявителя", "Копія посвідчення особи заявника") },
  registry_extract: { name: N("Extract from the State Register of Legal Entities, issued no more than 3 months before filing", "Extras din Registrul de Stat al unităților de drept, eliberat cu cel mult 3 luni înainte de depunere", "Выписка из Государственного реестра юридических лиц, выданная не более чем за 3 месяца до подачи", "Витяг з Державного реєстру юридичних осіб, виданий не більше ніж за 3 місяці до подання") },
  property: { name: N("Proof of ownership or of the right to use the property (cadastral register)", "Dovada dreptului de proprietate sau de folosință asupra imobilului (oficiul cadastral)", "Подтверждение права собственности или пользования недвижимостью (кадастр)", "Підтвердження права власності або користування нерухомістю (кадастр)") },
  site_sketch: { name: N("Sketch of where the installation stands on the property", "Schița grafică a amplasării instalației în cadrul bunului imobil", "Графическая схема размещения установки на объекте", "Графічна схема розміщення установки на об’єкті") },
  owner_consent: { optional: true, name: N("The owner's written consent, if the applicant is not the owner", "Acordul prealabil scris al proprietarului, dacă solicitantul nu este proprietar", "Письменное согласие собственника, если заявитель не собственник", "Письмова згода власника, якщо заявник не власник") },
  authorization: { optional: true, name: N("Power of attorney, if a representative applies", "Procura, dacă depune un reprezentant", "Доверенность, если подаёт представитель", "Довіреність, якщо подає представник") },
  // earlier checklists
  site_plan: { name: N("Site plan with the connection point", "Planul de situație cu punctul de racordare", "Ситуационный план с точкой подключения", "Ситуаційний план з точкою приєднання") },
  single_line: { name: N("Single-line diagram of the installation", "Schema monofilară a instalației", "Однолинейная схема установки", "Однолінійна схема установки") },
  equipment: { name: N("Inverter and panel data sheets / certificates", "Fișele tehnice și certificatele invertorului și panourilor", "Технические паспорта и сертификаты инвертора и панелей", "Технічні паспорти та сертифікати інвертора і панелей") },
};

/**
 * The documents the application is filed with, by who applies. Taken from the application form's own
 * list (RED Nord's "Cerere pentru emiterea avizului de racordare a centralelor electrice", point 21 of the
 * connection regulation it prints): a person files the identity card and the proof of the property; a
 * company the register extract (under 3 months old), the proof, the site sketch and, if it is not the
 * owner, the owner's consent. A single-line diagram and data sheets are asked only for a connection to the
 * transmission network, so they are not on this list. The regulation is the same for both operators;
 * Premier's own form was not available to compare, so check it for anything extra.
 */
const LISTS = {
  person: ["application", "signed", "id_copy", "property", "authorization"],
  company: ["application", "signed", "registry_extract", "property", "site_sketch", "owner_consent", "authorization"],
};

/**
 * The documents for an operator and an applicant kind: from the operator's rules when given (lib/gridRules.js,
 * which a platform admin edits), else the list above. Each carries `maxAgeDays` when it must be recent.
 * @returns {{ id: string, auto?: boolean, optional?: boolean, name: object, maxAgeDays?: number }[]} [] for an unknown operator
 */
export function checklistFor(operator, kind = "person", rules = null) {
  if (!["premier", "rednord"].includes(operator)) return [];
  const k = kind === "company" ? "company" : "person";
  const ids = rules?.docs?.[k] || LISTS[k];
  const ages = rules?.maxAgeDays || { registry_extract: 90 };
  return ids.map((id) => {
    const d = DOC[id] || (rules?.custom?.[id] ? { name: rules.custom[id].name, optional: !!rules.custom[id].optional } : null);
    if (!d) return null;
    return { id, ...d, ...(ages[id] ? { maxAgeDays: Number(ages[id]) } : {}) };
  }).filter(Boolean);
}

/** The name of a document in a language, whether or not it is on today's list (an admin's own one with `rules`). */
export const docName = (id, lang = "ro", rules = null) => {
  const n = DOC[id]?.name || rules?.custom?.[id]?.name;
  return n?.[lang] || n?.ro || id;
};

/** A person's checklist, per operator (the company's is checklistFor(op, "company")). */
export const OPERATOR_CHECKLIST = { premier: checklistFor("premier"), rednord: checklistFor("rednord") };

/**
 * Is the package complete?
 * @param {object} a
 * @param {string} a.operator
 * @param {"person"|"company"} [a.kind]  who applies: decides which documents are asked for
 * @param {string[]} a.missingDetails  gridMissing(applicant): fields the form still lacks
 * @param {string[]} a.attached        ids the installer confirms are attached
 * @param {boolean} [a.representative] the applicant is represented (the power of attorney becomes required)
 * @param {number} [a.installedKw]     the installation's power (lib/gridPower.js productionPower)
 * @param {number|null} [a.contractedKw] the power contracted with the supplier for the site
 * @param {number|null} [a.ceilingKw]  the household prosumer limit
 * @param {object|null} [a.rules]      the operator's rules (lib/gridRules.js); the list above without them
 * @param {Record<string,string>} [a.docDates]  a recent-only document's issue date, YYYY-MM-DD
 * @param {string} [a.today]           YYYY-MM-DD, for the documents' age
 * @returns {{ complete: boolean, missingDetails: string[], missingDocs: string[], expiredDocs: {id:string, state:string, age:number|null, max:number}[],
 *            checklist: object[], powerBlocks: string[], powerWarns: string[], overridable: boolean, blockers: string[] }}
 *   blockers: what an owner or a manager may send past with a written reason (a document missing or too old, a power
 *   check); missing applicant details are never among them, as the operator's form cannot be filled without them
 */
export function checkPackage({ operator, kind = "person", missingDetails = [], attached = [], representative = false, installedKw = null, contractedKw = null, ceilingKw = null, rules = null, docDates = {}, today = "" }) {
  const list = checklistFor(operator, kind, rules);
  const has = new Set(attached);
  const checklist = list.map((d) => {
    const required = !d.optional || (d.id === "authorization" && representative);
    return { id: d.id, auto: !!d.auto, required, present: d.auto || has.has(d.id), ...(d.maxAgeDays ? { maxAgeDays: d.maxAgeDays, issued: docDates?.[d.id] || null } : {}) };
  });
  const missingDocs = checklist.filter((c) => c.required && !c.present).map((c) => c.id);
  // a recent-only document that is in the package needs its issue date, within the limit
  const expiredDocs = checklist.filter((c) => c.present && c.maxAgeDays && today)
    .map((c) => ({ id: c.id, max: c.maxAgeDays, ...docAge(c.issued, c.maxAgeDays, today) }))
    .filter((x) => x.state !== "ok");
  const power = installedKw != null ? powerIssues({ installedKw, contractedKw, ceilingKw, kind }) : { blocks: [], warns: [] };
  const blockers = [...missingDocs.map((id) => "doc:" + id), ...expiredDocs.map((x) => "age:" + x.id), ...power.blocks.map((c) => "power:" + c)];
  return {
    complete: !missingDetails.length && !blockers.length && list.length > 0,
    missingDetails, missingDocs, expiredDocs, checklist, powerBlocks: power.blocks, powerWarns: power.warns,
    blockers, overridable: list.length > 0 && !missingDetails.length && blockers.length > 0,
  };
}

// meter_installed: the operator fitted the two-way meter; connected: the system is live on the grid
export const GRID_STATUSES = ["submitted", "docs_requested", "approved", "meter_installed", "connected", "rejected"];
const NEXT = {
  submitted: ["docs_requested", "approved", "rejected"], docs_requested: ["submitted", "rejected"],
  approved: ["meter_installed", "connected", "rejected"], meter_installed: ["connected", "rejected"], connected: [], rejected: [],
};
export const gridNext = (from) => NEXT[from] || [];

export function nextGridStatus(from, to) {
  if (!GRID_STATUSES.includes(to)) return { ok: false, error: "unknown_status" };
  if (from === to) return { ok: true, same: true };
  return gridNext(from).includes(to) ? { ok: true } : { ok: false, error: "bad_transition" };
}

/** The grid-file stage a status ticks (lib/mdGrid.js GRID_STAGES), or null. */
export const STAGE_FOR = { submitted: "applied", approved: "approval", meter_installed: "meter", connected: "meter" };

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
