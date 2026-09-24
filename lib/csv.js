// lib/csv.js — the formula-injection guard both CSV exports need
// (app/api/export-projects/route.js, app/api/export-invoices/route.js).
// Previously copy-pasted identically in both files and untested in either.
//
// FORMULA INJECTION. Excel and LibreOffice evaluate any cell beginning with
// = + - @ (or a leading tab/CR). export-projects carries client_name/title
// from leads.name, which /api/widget-lead accepts from the open internet
// with no account — a stranger could plant "=cmd|..." in an installer's
// pipeline and have it execute when they open the CSV. A leading apostrophe
// is the standard neutraliser: spreadsheet software then treats the cell as
// literal text instead of a formula.

// Plain numbers we generate ourselves — never neutered, so "-2" stays a number.
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvEsc(v) {
  v = String(v == null ? "" : v);
  if (!PLAIN_NUMBER.test(v) && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
