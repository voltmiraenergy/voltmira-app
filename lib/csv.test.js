import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEsc } from "./csv.js";

test("a plain number stays a plain number, not quoted or neutered", () => {
  assert.equal(csvEsc(42), "42");
  assert.equal(csvEsc(-2), "-2");
  assert.equal(csvEsc(3.5), "3.5");
  assert.equal(csvEsc("-2"), "-2");
});

test("=, +, -, @ formula-injection prefixes get neutered with a leading apostrophe", () => {
  assert.equal(csvEsc("=cmd|'/c calc'!A1"), "'=cmd|'/c calc'!A1");
  assert.equal(csvEsc("+1+1"), "'+1+1");
  assert.equal(csvEsc("-2+3"), "'-2+3");
  assert.equal(csvEsc("@SUM(A1:A2)"), "'@SUM(A1:A2)");
});

test("a leading tab or carriage return is also neutered (DDE-style injection)", () => {
  assert.equal(csvEsc("\tmalicious"), "'\tmalicious");
  assert.equal(csvEsc("\rmalicious"), "'\rmalicious");
});

test("ordinary text with no dangerous prefix is left untouched", () => {
  assert.equal(csvEsc("Ion Popescu"), "Ion Popescu");
  assert.equal(csvEsc("Str. Florilor 5"), "Str. Florilor 5");
});

test("a value containing a comma, quote, newline or semicolon is wrapped and quotes doubled", () => {
  assert.equal(csvEsc("Popescu, Ion"), '"Popescu, Ion"');
  assert.equal(csvEsc('Say "hi"'), '"Say ""hi"""');
  assert.equal(csvEsc("line1\nline2"), '"line1\nline2"');
  assert.equal(csvEsc("a;b"), '"a;b"');
});

test("a dangerous prefix AND a comma both apply — neutered first, then quoted", () => {
  assert.equal(csvEsc("=A1,B1"), "\"'=A1,B1\"");
});

test("null/undefined become an empty string, never throw", () => {
  assert.equal(csvEsc(null), "");
  assert.equal(csvEsc(undefined), "");
});
