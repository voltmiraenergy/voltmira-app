// app/api/marketplace/profile/route.js — the installer's public profile
// (docs/MARKETPLACE.md).
// POST { action: "save", ...fields }  save it (a change to a checked field asks for a new check)
// POST { action: "verify" }           ask VoltMira to check it
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { installerGuard } from "../../../../lib/marketGuard.js";
import { saveProfile, requestVerification } from "../../../../lib/profileFlow.js";
import { RAIONS } from "../../../../lib/mdRaions.js";
import { platformAdmins } from "../../../../lib/platformAdmin.js";
import { sendEmail, emailConfigured } from "../../../../lib/email.js";
import { escapeHtml } from "../../../../lib/safe.js";

export async function POST(req) {
  const g = await installerGuard({ manage: true });
  if (g instanceof Response) return g;
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const db = supabaseAdmin();
  const actor = { id: g.user.id, email: g.user.email };
  if (b.action === "verify") {
    const r = await requestVerification(db, {
      companyId: g.co.id, actor,
      // the platform admins hear that a check is waiting (/admin/installers)
      io: { notify: async () => {
        if (!emailConfigured()) return;
        const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com").replace(/\/+$/, "");
        for (const to of platformAdmins()) await sendEmail({ to, subject: `Verificare instalator: ${g.co.legal_name || g.co.name}`, html: `<p>${escapeHtml(g.co.legal_name || g.co.name || "")} a cerut verificarea profilului.</p><p><a href="${base}/admin/installers">${base}/admin/installers</a></p>` });
      } },
    });
    return NextResponse.json(r, { status: r.ok ? 200 : r.error === "needs_db" ? 503 : 400 });
  }
  const r = await saveProfile(db, { company: g.co, input: b, raionIds: RAIONS.filter((x) => x.covered).map((x) => x.id), actor });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "needs_db" ? 503 : 400 });
}
