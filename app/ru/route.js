// app/ru/route.js — the homepage in Russian, served as Russian HTML.
// Matters for Moldova, where a large share of installers work in Russian.
import { landingResponse } from "../../lib/landing.js";

export const dynamic = "force-static";

export function GET() {
  return landingResponse("ru");
}
