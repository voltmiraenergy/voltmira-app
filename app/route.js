// app/route.js — serves the marketing homepage (voltmira.com) as a full HTML
// document so its inline <style> and <script> run exactly as designed.
// The application lives behind /login → /dashboard.
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

export function GET() {
  const html = fs.readFileSync(
    path.join(process.cwd(), "app/_landing/landing.html"),
    "utf8"
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
