import { test } from "node:test";
import assert from "node:assert/strict";
import { toIntlPhone, phoneInText } from "./phone.js";

test("Moldovan numbers written the local way get 373", () => {
  assert.equal(toIntlPhone("069 123 456"), "37369123456");
  assert.equal(toIntlPhone("069-12-34-56", "MD"), "37369123456");
  assert.equal(toIntlPhone("69123456", "MD"), "37369123456");
  assert.equal(toIntlPhone("+373 69 123 456"), "37369123456");
  assert.equal(toIntlPhone("00373 69 123 456"), "37369123456");
  assert.equal(toIntlPhone("373 69 123 456"), "37369123456");
});

test("Romania and Ukraine by the quote's market", () => {
  assert.equal(toIntlPhone("0721 234 567", "RO"), "40721234567");
  assert.equal(toIntlPhone("050 123 4567", "UA"), "380501234567");
  assert.equal(toIntlPhone("+40 721 234 567", "MD"), "40721234567");
});

test("what cannot be a phone gives nothing", () => {
  assert.equal(toIntlPhone(""), "");
  assert.equal(toIntlPhone(null), "");
  assert.equal(toIntlPhone("12345"), "");
  assert.equal(toIntlPhone("0721 234 567", "MD"), "");
});

test("a phone line in notes", () => {
  assert.equal(phoneInText("Casa in Codru.\nTel: 069 123 456\nVrea baterie"), "069 123 456");
  assert.equal(phoneInText("телефон +373 79 918 402"), "+373 79 918 402");
  assert.equal(phoneInText("no number here, 6 kW"), "");
});
