import { test } from "node:test";
import assert from "node:assert/strict";
import { dealQuestionEmail, dealActivityEmail, eventText, plantUrl } from "./dealEmail.js";

const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("a question alert names the bank, the item and the plant, and carries the question safely", () => {
  const { subject, html } = dealQuestionEmail({ lang: "ro", bank: "MAIB", plant: "Parcul hibrid Sud", item: "grid", askedBy: "Ana Pop", body: "Când e avizul? <script>x</script>", url: "https://app.voltmira.com/portfolios/p1#plants" });
  assert.equal(subject, "MAIB a întrebat despre Racordarea la rețea: Parcul hibrid Sud");
  assert.match(html, /<html lang="ro">/);
  assert.match(html, /Întreabă Ana Pop/);
  assert.match(html, /Când e avizul\? &lt;script&gt;x&lt;\/script&gt;/);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /href="https:\/\/app\.voltmira\.com\/portfolios\/p1#plants"/);
  assert.ok(!/[—–·✓]/.test(strip(html)), "no dashes, middle dots or ticks");
});

test("an activity alert lists what the bank did, oldest first, in the workspace's language", () => {
  const events = [
    { at: "2026-10-04T13:38:00Z", what: "pack", detail: "" },
    { at: "2026-10-04T13:30:00Z", what: "open", detail: "" },
    { at: "2026-10-04T13:35:00Z", what: "document", detail: "Aviz.pdf" },
  ];
  const { subject, html } = dealActivityEmail({ lang: "en", bank: "OTP Bank", plant: "South park", events, url: "u" });
  assert.equal(subject, "OTP Bank opened the deal room: South park");
  const text = strip(html);
  const i = (s) => text.indexOf(s);
  assert.ok(i("Opened the deal room") < i("Downloaded Aviz.pdf") && i("Downloaded Aviz.pdf") < i("Downloaded the pack"));
  // Moldovan time: 13:30 UTC is 16:30 in Chișinău in October
  assert.match(text, /16:30/);
  assert.ok(!/[—–·✓]/.test(text));
});

test("event lines, and the link back to the plant", () => {
  assert.equal(eventText({ what: "question", detail: "Racordarea la rețea" }, "ro"), "A întrebat despre Racordarea la rețea");
  assert.equal(eventText({ what: "summary" }, "uk"), "Прочитав кредитне резюме");
  assert.equal(plantUrl("https://app.voltmira.com/", "p1"), "https://app.voltmira.com/portfolios/p1#plants");
  assert.equal(plantUrl("", "p1"), "https://app.voltmira.com/portfolios/p1#plants");
});
