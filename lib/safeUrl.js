// lib/safeUrl.js — may the server call this address on a customer's say-so? A webhook URL typed in
// Settings is fetched from VoltMira's servers; pointed at 127.0.0.1, a cloud metadata address or an
// internal host it would make the server probe its own network. This keeps to https, a named public
// host, the standard port and no credentials in the URL. It looks at the text of the address only (it
// cannot see what a name resolves to), so callers also refuse redirects (redirect: "error"). Pure.
const BAD_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home|.*\.corp|metadata\.google\.internal)$/i;

function privateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** @returns {boolean} */
export function isPublicHttpsUrl(raw) {
  let u;
  try { u = new URL(String(raw || "")); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host.includes(":")) return false;           // an IPv6 literal: never a public webhook
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return false;   // 2130706433, 0x7f000001
  if (privateIPv4(host)) return false;
  if (BAD_HOST.test(host)) return false;
  if (!host.includes(".")) return false;                    // a bare name is an internal one
  return true;
}
