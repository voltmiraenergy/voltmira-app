import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicHttpsUrl } from "./safeUrl.js";

test("a public https address is allowed", () => {
  for (const ok of ["https://hooks.zapier.com/hooks/catch/1/abc/", "https://eu1.make.com/x?y=1", "https://crm.example.md:443/in", "https://203.0.113.9/hook"])
    assert.equal(isPublicHttpsUrl(ok), true, ok);
});

test("loopback, private, link-local and metadata addresses, internal names and odd forms are refused", () => {
  for (const bad of [
    "http://hooks.zapier.com/x", "ftp://x.example.com", "https://localhost/x", "https://127.0.0.1/x", "https://127.1.2.3/",
    "https://10.0.0.5/x", "https://172.16.0.1/", "https://172.31.255.255/", "https://192.168.1.10/", "https://169.254.169.254/latest/meta-data",
    "https://metadata.google.internal/", "https://db.internal/", "https://printer.local/", "https://intranet/", "https://[::1]/", "https://[fd00::1]/",
    "https://2130706433/", "https://0x7f000001/", "https://user:pass@example.com/", "https://example.com:8443/", "https://0.0.0.0/", "https://100.64.0.1/", "not a url", "",
  ]) assert.equal(isPublicHttpsUrl(bad), false, bad);
});
