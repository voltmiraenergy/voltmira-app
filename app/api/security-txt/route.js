// app/api/security-txt/route.js — served at /.well-known/security.txt via a
// rewrite in next.config.mjs (public/ dotfolders aren't reliably served).
export const dynamic = "force-static";

const BODY = `Contact: mailto:voltmiraenergy@gmail.com
Expires: 2027-08-11T00:00:00.000Z
Preferred-Languages: en, ro
Canonical: https://voltmira.com/.well-known/security.txt
`;

export function GET() {
  return new Response(BODY, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
