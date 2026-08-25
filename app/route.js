// app/route.js — the marketing homepage (English, and the x-default).
//
// TEMPORARY: serving the photo-led redesign (app/_landing/landing-en-v2.html)
// directly for English while it's under review, bypassing lib/landing.js.
// /ro and /ru are untouched — they still render the original landing.html
// through lib/landing.js, so nothing changes for those visitors. Once the
// new design is approved, fold it back into landing.html + i18n.mjs so all
// three languages share one template again, and revert this file to:
//   import { landingResponse } from "../lib/landing.js";
//   export function GET() { return landingResponse("en"); }
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

let cachedHtml = null;
function source() {
  if (!cachedHtml) {
    cachedHtml = fs.readFileSync(path.join(process.cwd(), "app/_landing/landing-en-v2.html"), "utf8");
  }
  return cachedHtml;
}

export function GET() {
  return new Response(source(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
