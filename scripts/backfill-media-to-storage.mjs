// scripts/backfill-media-to-storage.mjs — one-time migration: move every
// existing company logo / user avatar that's still a base64 data: URL
// (inlined before supabase/add-storage-media.sql) into the real public-media
// Storage bucket, and rewrite logo_url/avatar_url to the resulting public URL.
//
// Run AFTER applying supabase/add-storage-media.sql in the Supabase SQL
// editor (the bucket must exist first). Uses the service role — bypasses RLS
// — because this rewrites rows across every company, not just the caller's
// own. Never destructive: a row that fails to convert is left exactly as it
// was (still base64, still rendering fine) and logged, not deleted.
//
// Run:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-media-to-storage.mjs
// (Both are already in .env.local for local/dev use — a real run against
// production should pass production's own values explicitly.)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local by hand — this script runs outside Next.js, which is the
// only thing that auto-loads it.
try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* no .env.local — rely on real env vars being set already */ }

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Aborting.");
  process.exit(1);
}
const admin = createClient(URL_, SERVICE_KEY);

function dataUrlToBlob(dataUrl) {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return { buf, contentType: m[1] };
}

async function migrateOne({ table, idCol, urlCol, id, dataUrl, pathPrefix }) {
  const parsed = dataUrlToBlob(dataUrl);
  if (!parsed) { console.warn(`skip ${table}/${id}: not a recognizable data: URL`); return false; }
  const ext = parsed.contentType === "image/jpeg" ? "jpg" : parsed.contentType.split("/")[1];
  // Same two-level path the real upload flows use (settings/page.jsx,
  // ProfileForm.jsx) — service role bypasses RLS so this script would work
  // either way, but a mismatched path here would leave an orphaned object
  // the next real upload never overwrites.
  const path = pathPrefix === "logos" ? `logos/${id}/logo.${ext}` : `avatars/${id}/avatar.${ext}`;
  const { error: upErr } = await admin.storage.from("public-media")
    .upload(path, parsed.buf, { upsert: true, contentType: parsed.contentType, cacheControl: "3600" });
  if (upErr) { console.error(`upload failed ${table}/${id}:`, upErr.message); return false; }
  const { data } = admin.storage.from("public-media").getPublicUrl(path);
  const { error: updErr } = await admin.from(table).update({ [urlCol]: data.publicUrl }).eq(idCol, id);
  if (updErr) { console.error(`row update failed ${table}/${id}:`, updErr.message); return false; }
  console.log(`migrated ${table}/${id} -> ${data.publicUrl}`);
  return true;
}

async function run() {
  let ok = 0, fail = 0;

  const { data: companies, error: coErr } = await admin.from("companies").select("id, logo_url").like("logo_url", "data:image/%");
  if (coErr) throw coErr;
  for (const co of companies || []) {
    const good = await migrateOne({ table: "companies", idCol: "id", urlCol: "logo_url", id: co.id, dataUrl: co.logo_url, pathPrefix: "logos" });
    good ? ok++ : fail++;
  }

  const { data: profiles, error: prErr } = await admin.from("profiles").select("id, avatar_url").like("avatar_url", "data:image/%");
  if (prErr) throw prErr;
  for (const p of profiles || []) {
    const good = await migrateOne({ table: "profiles", idCol: "id", urlCol: "avatar_url", id: p.id, dataUrl: p.avatar_url, pathPrefix: "avatars" });
    good ? ok++ : fail++;
  }

  console.log(`\nDone: ${ok} migrated, ${fail} failed/skipped.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
