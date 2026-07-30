// app/api/export-projects/route.js — pipeline CSV download (demo parity: same
// columns, BOM, filename as the demo's export-csv action). Auth: the caller's
// session cookie; RLS scopes rows to their company. No session → 401.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { quote, defaultEngineSettings } from "@voltmira/engine";
import { proposalStatsByProject } from "../../../lib/proposalStats.js";

export const dynamic = "force-dynamic";

function csvEsc(v) {
  v = String(v == null ? "" : v);
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
  const E = { ...defaultEngineSettings(), ...(co?.engine || {}) };
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
    const q = quote({
      kw: +p.kw, price: +p.price, cons: +p.cons, batt: p.batt, market: p.market,
      useMonthly: p.use_monthly, consMonthly: p.cons_monthly, afmSubsidy: p.afm_subsidy,
      yieldOverride: p.yield_per_kwp ? +p.yield_per_kwp : undefined,
      monthlyYieldShape: p.monthly_yield_shape || undefined,
    }, E).e;
    const st = stats.get(p.id);
    return [
      p.title || "", p.client_name || "", p.address || "", p.market,
      (+p.kw).toFixed(1), p.batt ? "yes" : "no",
      q.payback == null ? "25+" : q.payback.toFixed(1), Math.round(q.cost),
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
