import { test } from "node:test";
import assert from "node:assert/strict";
import { relTime } from "./relTime.js";

const NOW = Date.parse("2026-09-25T12:00:00Z");
const ago = (sec) => new Date(NOW - sec * 1000).toISOString();

test("picks the coarsest unit that still reads naturally", () => {
  assert.equal(relTime(ago(20), "en-GB", NOW), "now");
  assert.equal(relTime(ago(5 * 60), "en-GB", NOW), "5 minutes ago");
  assert.equal(relTime(ago(3 * 3600), "en-GB", NOW), "3 hours ago");
  assert.equal(relTime(ago(86400), "en-GB", NOW), "yesterday");
  assert.equal(relTime(ago(6 * 86400), "en-GB", NOW), "6 days ago");
  assert.equal(relTime(ago(90 * 86400), "en-GB", NOW), "3 months ago");
});

test("speaks the workspace language", () => {
  assert.equal(relTime(ago(86400), "ro-RO", NOW), "ieri");
  assert.equal(relTime(ago(86400), "ru-RU", NOW), "вчера");
});
