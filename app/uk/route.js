// app/uk/route.js — the homepage in Ukrainian, served as Ukrainian HTML.
// For installers in Ukraine, and Ukrainian speakers in Moldova.
import { landingResponse } from "../../lib/landing.js";

export const dynamic = "force-static";

export function GET() {
  return landingResponse("uk");
}
