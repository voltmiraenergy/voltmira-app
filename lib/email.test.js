import { test } from "node:test";
import assert from "node:assert/strict";
import { proposalEmail, proformaEmail, proposalNudgeEmail, resetPasswordEmail, teamInviteEmail, proposalOpenedEmail } from "./email.js";

// visible text only: tags, attributes and entities out
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
const LANGS = ["en", "ro", "ru", "uk"];

test("client emails come in all four languages, never in English for a Ukrainian or Romanian client", () => {
  for (const lang of LANGS) {
    const p = proposalEmail({ clientName: "Ana", companyName: "SolarTech", liveUrl: "https://x.test/p/abc", kw: 6, lang });
    const f = proformaEmail({ clientName: "Ana", companyName: "SolarTech", depositPct: 30, lang });
    const n = proposalNudgeEmail({ clientName: "Ana", companyName: "SolarTech", liveUrl: "https://x.test/p/abc", lang,
      then: { paybackYears: 7.25, monthlySavings: 80 }, now: { paybackYears: 6.9, monthlySavings: 85 }, currency: "MDL", fx: { MDL: 20 } });
    for (const m of [p, f, n]) {
      assert.ok(m.subject.length > 5);
      assert.ok(m.html.includes(`<html lang="${lang}">`), `${lang}: the html declares its language`);
      if (lang !== "en") assert.doesNotMatch(m.subject + text(m.html), /\b(Hello|Your solar proposal|Proforma invoice from|Sent by)\b/, `${lang} must not fall back to English`);
    }
  }
  assert.match(proposalEmail({ kw: 6, lang: "uk", companyName: "A", liveUrl: "u" }).subject, /Ваша пропозиція сонячної станції 6,0 кВт від A/);
  assert.match(proformaEmail({ depositPct: 30, lang: "ro", companyName: "A" }).subject, /Factură proforma \(avans 30%\) de la A/);
});

test("Romanian client emails use the formal voice", () => {
  const all = [
    proposalEmail({ clientName: "Ana", companyName: "A", liveUrl: "u", kw: 6, lang: "ro" }),
    proformaEmail({ clientName: "Ana", companyName: "A", depositPct: 30, lang: "ro" }),
    proposalNudgeEmail({ clientName: "Ana", companyName: "A", liveUrl: "u", lang: "ro", then: {}, now: {} }),
  ].map((m) => m.subject + " " + text(m.html)).join(" ");
  assert.match(all, /dumneavoastră/);
  assert.match(all, /Bună ziua/);
  assert.doesNotMatch(all, /\b(Salut|Deschide oferta|Răspunde direct|oferta ta|Oferta ta)\b/);
});

test("no em dashes, middle dots or arrows in any visible email text", () => {
  const msgs = [];
  for (const lang of LANGS) {
    msgs.push(proposalEmail({ clientName: "Ana", companyName: "A", liveUrl: "u", kw: 6, note: "x", lang }));
    msgs.push(proformaEmail({ clientName: "", companyName: "A", depositPct: 0, lang }));
    msgs.push(proposalNudgeEmail({ clientName: "Ana", companyName: "A", liveUrl: "u", lang, then: { paybackYears: null }, now: {} }));
    msgs.push(resetPasswordEmail({ resetLink: "https://x.test/r", lang }));
  }
  msgs.push(teamInviteEmail({ inviteLink: "https://x.test/i", companyName: "A" }));
  for (const m of msgs) {
    assert.doesNotMatch(m.subject + text(m.html), /[—·→]/, m.subject);
    assert.doesNotMatch(m.html, /&rarr;/, m.subject);
  }
});

test("the follow-up shows years and money in the reader's own format", () => {
  const n = proposalNudgeEmail({ clientName: "", companyName: "A", liveUrl: "u", lang: "uk",
    then: { paybackYears: 7.25, monthlySavings: 80 }, now: { paybackYears: 6.9, monthlySavings: 85 }, currency: "UAH", fx: { UAH: 50 } });
  const t = text(n.html);
  assert.match(t, /7,3 р\./);
  assert.match(t, /4\s?000 грн/);
  const ro = text(proposalNudgeEmail({ clientName: "", companyName: "A", liveUrl: "u", lang: "ro", then: { paybackYears: 7.25 }, now: {} }).html);
  assert.match(ro, /7,3 ani/);
});

test("names are escaped, never injected", () => {
  const p = proposalEmail({ clientName: "<b>x</b>", companyName: "<i>c</i>", liveUrl: "u", kw: 6, lang: "uk" });
  assert.doesNotMatch(p.html, /<b>x<\/b>|<i>c<\/i>/);
});

test("the installer's own emails speak the workspace's language, with no English left in Ukrainian or Romanian", () => {
  for (const lang of ["en", "ro", "ru", "uk"]) {
    const o = proposalOpenedEmail({ projectTitle: "Vila <Popescu>", clientName: "Ion", code: "ab12", opens: 3, seconds: 125, appUrl: "https://app.voltmira.com/", lang });
    const i = teamInviteEmail({ inviteLink: "https://x.test/i?a=1&b=2", companyName: "Solar & Co", lang });
    assert.match(o.html, new RegExp(`<html lang="${lang}">`));
    assert.match(i.html, new RegExp(`<html lang="${lang}">`));
    assert.doesNotMatch(o.subject + text(o.html) + i.subject + text(i.html), /[—·→]/);
    assert.ok(o.html.includes("Vila &lt;Popescu&gt;") && !o.html.includes("<Popescu>"), "names are escaped");
    assert.ok(i.html.includes("Solar &amp; Co") && i.html.includes("a=1&amp;b=2"));
    assert.match(o.html, /href="https:\/\/app\.voltmira\.com\/dashboard"/);
    assert.match(o.html, /href="https:\/\/app\.voltmira\.com\/settings"/);
  }
  const uk = proposalOpenedEmail({ projectTitle: "Дім", clientName: "Іван", code: "c", opens: 1, seconds: 59, lang: "uk" });
  assert.equal(uk.subject, "Іван щойно відкрив «Дім»");
  assert.match(text(uk.html), /59 с/);
  assert.doesNotMatch(text(uk.html), /Proposal|opened|Total/);
  const ro2 = proposalOpenedEmail({ projectTitle: "Casa", clientName: "", code: "c", opens: 4, seconds: 125, lang: "ro" });
  assert.equal(ro2.subject, "Clientul tău a deschis din nou „Casa” (4 deschideri)");
  assert.match(text(ro2.html), /2 min 5 s/);
  assert.equal(teamInviteEmail({ inviteLink: "u", companyName: "SolarTech", lang: "uk" }).subject, "Вас запрошено до SolarTech");
  // without a language it stays English, as before
  assert.equal(teamInviteEmail({ inviteLink: "u", companyName: "A" }).subject, "You're invited to join A");
});
