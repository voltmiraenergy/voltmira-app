// app/api/export-projects/route.js — pipeline CSV download (demo parity: same
// columns, BOM, filename as the demo's export-csv action). Auth: the caller's
// session cookie; RLS scopes rows to their company. No session → 401.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../lib/engineSettings.js";
import { proposalStatsByProject } from "../../../lib/proposalStats.js";
import { rowToQuoteInput } from "../../../lib/quoteInput.js";

export const dynamic = "force-dynamic";

// Plain numbers we generate ourselves — never neutered, so "-2" stays a number.
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function csvEsc(v) {
  v = String(v == null ? "" : v);
  // FORMULA INJECTION. Excel and LibreOffice evaluate any cell beginning with
  // = + - @ (or a leading tab/CR). This export carries client_name and title,
  // and those come from leads.name — which /api/widget-lead accepts from the
  // open internet with no account. A stranger could therefore plant "=cmd|..."
  // in an installer's pipeline and have it run when they open the CSV. A
  // leading apostrophe is the standard neutraliser: Excel treats the cell as
  // text and does not render the quote.
  if (!PLAIN_NUMBER.test(v) && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export async function GET() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const [{ data: co }, { data: rows }, stats] = await Promise.all([
    sb.from("companies").select("id, engine").maybeSingle(),
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    proposalStatsByProject(sb),
  ]);
  const E = await companyEngine(co);
  const daysAgo = (iso) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : "";

  // Owner names via service role scoped to the caller's own company
  // (profiles RLS recurses under a user session — see project notes).
  const { data: team } = co
    ? await supabaseAdmin().from("profiles").select("id, name, email").eq("company_id", co.id)
    : { data: [] };
  const ownerName = (id) => {
    const m = (team || []).find(x => x.id === id);
    return m ? (m.name || m.email) : "";
  };

  const head = ["Title", "Client", "Address", "Market", "System kW", "Battery", "Payback (years)", "Value (EUR)", "Status", "Owner", "Opens", "Sent (days ago)", "Notes", "Updated"];
  const lines = (rows || []).map(p => {
    // Same input builder as the dashboard/projects list, so the exported payback
    // and value match the app exactly (this used to omit the battery capacity and
    // the bill-of-materials total, so battery/BOM quotes exported wrong numbers).
    const q = quote(rowToQuoteInput(p), E).e;
    const st = stats.get(p.id);
    return [
      p.title || "", p.client_name || "", p.address || "", p.market,
      (+p.kw).toFixed(1), p.batt ? "yes" : "no",
      q.payback == null ? "25+" : q.payback.toFixed(1), Math.round(q.grossCost),
      p.status, ownerName(p.owner_id),
      st ? (st.opens || 0) : "", st ? daysAgo(st.sentAt) : "", p.notes || "",
      new Date(p.updated_at).toISOString().slice(0, 10),
    ].map(csvEsc).join(",");
  });

  const csv = "﻿" + head.join(",") + "\n" + lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="voltmira-pipeline-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
