import { test } from "node:test";
import assert from "node:assert/strict";
import { proposalFileName, slugName } from "./proposalFileName.js";

test("the PDF carries the installer's name, for every workspace; VoltMira's only without a name", () => {
  assert.equal(proposalFileName({ companyName: "SolarTech Chișinău SRL", plan: "pro", code: "ab12cd" }), "SolarTech-Chisinau-SRL-proposal-ab12cd.pdf");
  assert.equal(proposalFileName({ companyName: "SolarTech", plan: "team", code: "x9" }), "SolarTech-proposal-x9.pdf");
  assert.equal(proposalFileName({ companyName: "SolarTech", plan: "free", code: "x9" }), "SolarTech-proposal-x9.pdf");
  assert.equal(proposalFileName({ companyName: "", plan: "pro", code: "x9" }), "VoltMira-proposal-x9.pdf");
});

test("a name is cleaned to ASCII, bounded, and a code cannot break the header", () => {
  assert.equal(slugName("  Ștefan & Fiii — Energie!  "), "Stefan-Fiii-Energie");
  assert.ok(slugName("a".repeat(100)).length <= 40);
  assert.equal(proposalFileName({ companyName: "A", plan: "pro", code: 'a"b\r\nc' }), "A-proposal-abc.pdf");
});
