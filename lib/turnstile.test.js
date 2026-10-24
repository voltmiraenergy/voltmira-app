import { test } from "node:test";
import assert from "node:assert/strict";
import { turnstileOk } from "./turnstile.js";

const answer = (success) => async () => ({ json: async () => ({ success }) });

test("without a secret the check lets the request through", async () => {
  assert.equal(await turnstileOk("", { secret: "" }), true);
});

test("with a secret: no token fails, Cloudflare's answer decides, a network error fails", async () => {
  assert.equal(await turnstileOk("", { secret: "s", fetchImpl: answer(true) }), false);
  assert.equal(await turnstileOk("tok", { secret: "s", fetchImpl: answer(true) }), true);
  assert.equal(await turnstileOk("tok", { secret: "s", fetchImpl: answer(false) }), false);
  assert.equal(await turnstileOk("tok", { secret: "s", fetchImpl: async () => { throw new Error("down"); } }), false);
});
