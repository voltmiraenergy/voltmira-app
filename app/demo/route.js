// app/demo/route.js — serves the self-contained live demo (SolarTech Iași,
// sample data, resets on refresh) at /demo, same pattern as the landing route.
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

export function GET() {
  const html = fs.readFileSync(
    path.join(process.cwd(), "app/_landing/demo.html"),
    "utf8"
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
