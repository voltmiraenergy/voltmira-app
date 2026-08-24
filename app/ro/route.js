// app/ro/route.js — the homepage in Romanian, served as Romanian HTML.
// Same document, translated on the server: <html lang="ro">, Romanian title,
// description and body copy, canonical https://voltmira.com/ro.
import { landingResponse } from "../../lib/landing.js";

export const dynamic = "force-static";

export function GET() {
  return landingResponse("ro");
}
