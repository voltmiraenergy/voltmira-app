// app/route.js — the marketing homepage (English, and the x-default).
// Rendered server-side per language by lib/landing.js so /ro and /ru are real
// documents rather than the same English HTML behind an hreflang tag.
import { landingResponse } from "../lib/landing.js";

export const dynamic = "force-static";

export function GET() {
  return landingResponse("en");
}
