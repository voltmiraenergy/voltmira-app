// app/api/projects/[id]/handover-pdf/route.js — the handover of a won job to its client, as a PDF in the client's
// language (projects.client_lang, else the workspace's): the system and its equipment, the serial numbers, the work
// checked on site, up to eight photos, the warranty, and the client's signature from the on-site record
// (lib/siteRecord.js, SiteRecord.jsx). A won job's paperwork, so it waits on the fee per won project
// (lib/jobFees.js) like the rest. Rendered from markup built here, photos inlined as data, nothing fetched.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../../../lib/supabase.js";
import { currentUser, currentCompany } from "../../../../../lib/session.js";
import { projectVisibility } from "../../../../../lib/projectAccess.js";
import { jobGate } from "../../../../../lib/jobFeeServer.js";
import { cleanRecord, FIELD_ITEMS, SERIAL_KINDS, PHOTO_SLOTS } from "../../../../../lib/siteRecord.js";
import { jt } from "../../../../../lib/jobText.js";
import { bomLineText } from "../../../../../lib/quoteAnalysis.js";
import { escapeHtml } from "../../../../../lib/safe.js";
import { renderHtmlPdf } from "../../../../../lib/renderProposalPdf.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { ensureServiceToken } from "../../../../../lib/serviceServer.js";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const MAX_PHOTOS = 8;

export async function GET(req, props) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  if (await isRateLimited(`handover:${clientIp(req)}`, 20, 3600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  const sb = await supabaseServer();
  const { data: project } = await sb.from("projects").select("*").eq("id", id).maybeSingle();
  if (!co || !project || project.company_id !== co.id || !(await projectVisibility(user, co))(project)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const gate = await jobGate(supabaseAdmin(), { project, co, user });
  if (gate.locked) return NextResponse.redirect(new URL(`/projects/${id}?fee=${gate.error === "needs_idno" ? "idno" : "locked"}`, req.url));

  const lang = ["en", "ro", "ru", "uk"].includes(project.client_lang) ? project.client_lang : co.lang || "ro";
  const J = (k, v) => jt(k, lang, v);
  const loc = LOCS[lang] || "ro-RO";
  const { data: site } = await sb.from("job_site").select("record").eq("project_id", id).maybeSingle();
  const rec = cleanRecord(site?.record);
  const { data: photos } = await sb.from("job_photos").select("slot, path").eq("project_id", id).order("created_at").limit(40);
  // the photos, one or two per place, inlined: the renderer fetches nothing
  const chosen = [];
  for (const slot of PHOTO_SLOTS) for (const ph of (photos || []).filter((x) => x.slot === slot).slice(0, 2)) if (chosen.length < MAX_PHOTOS) chosen.push(ph);
  const imgs = [];
  for (const ph of chosen) {
    const { data: blob } = await sb.storage.from("job-photos").download(ph.path);
    if (!blob) continue;
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    imgs.push({ slot: ph.slot, src: `data:image/jpeg;base64,${b64}` });
  }

  const e = escapeHtml;
  // the client's "report a problem" link, as a QR code to scan from the paper (Phase 5); left out before add-service.sql
  let service = null;
  {
    const admin = supabaseAdmin();
    const { data: tk, error: tkErr } = await admin.from("projects").select("id, service_token").eq("id", id).maybeSingle();
    const token = !tkErr && tk ? await ensureServiceToken(admin, tk) : null;
    if (token) {
      const url = `${String(process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, "")}/s/${token}`;
      service = { url, svg: await QRCode.toString(url, { type: "svg", margin: 0, width: 96, color: { dark: "#142A21", light: "#FFFFFF" } }) };
    }
  }
  const day = (iso) => new Date(iso).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Chisinau" });
  const today = day(new Date().toISOString());
  const company = co.legal_name || co.name || "";
  const client = rec.signature?.name || project.client_name || "";
  const kw = Number(project.kw || 0).toLocaleString(loc, { maximumFractionDigits: 2 });
  const bom = (Array.isArray(project.bom) ? project.bom : []).filter((l) => ["panel", "inverter", "battery"].includes(l?.kind));
  const serialRows = SERIAL_KINDS.filter((k) => rec.serials[k].length).map((k) => `<tr><th>${e(J("s_" + k))}</th><td class="mono">${rec.serials[k].map(e).join(", ")}</td></tr>`).join("");
  const checks = FIELD_ITEMS.filter((k) => rec.checklist[k]).map((k) => `<li>${e(J("f_" + k))}<small>${e(day(rec.checklist[k].at))}</small></li>`).join("");

  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${e(J("ho_title"))}</title><style>
  @page{size:A4;margin:16mm 15mm}
  body{font-family:Inter,system-ui,sans-serif;color:#142A21;font-size:11.5px;line-height:1.5;margin:0}
  h1{font-size:20px;margin:0 0 4px;letter-spacing:-.01em}
  h2{font-size:13px;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #E3E1D6}
  .meta{color:#5D6B62;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;vertical-align:top;padding:5px 6px;border-bottom:1px solid #EFEEE7}
  th{width:30%;color:#5D6B62;font-weight:600}
  .mono{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;word-break:break-all}
  ul{margin:0;padding-left:18px}
  li small{color:#5D6B62;margin-left:6px}
  .photos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .photos figure{margin:0}
  .photos img{width:100%;height:110px;object-fit:cover;border-radius:4px;border:1px solid #E3E1D6}
  .photos figcaption{font-size:9.5px;color:#5D6B62}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:22px;break-inside:avoid}
  .sign div{border-top:1px solid #142A21;padding-top:6px}
  .sign img{height:60px;display:block;margin-bottom:4px}
  .note{color:#5D6B62}
  .svc{display:flex;gap:14px;align-items:center;margin:14px 0;padding:10px 12px;border:1px solid #E3E1D6;border-radius:6px}
  .svc .qr svg{width:96px;height:96px;display:block}
  </style></head><body>
  <h1>${e(J("ho_title"))}</h1>
  <p class="meta">${e(company)}, ${e(today)}</p>
  <p>${e(J("ho_intro", { company, client, address: project.address || project.title || "" }))}</p>
  <h2>${e(J("ho_system"))}</h2>
  <table><tr><th>${e(J("ho_power"))}</th><td>${e(kw)} kW</td></tr>
  ${bom.length ? `<tr><th>${e(J("ho_equipment"))}</th><td>${bom.map((l) => e(bomLineText(l, lang))).join("<br>")}</td></tr>` : ""}</table>
  ${serialRows ? `<h2>${e(J("ho_serials"))}</h2><table>${serialRows}</table>` : ""}
  ${checks ? `<h2>${e(J("ho_checks"))}</h2><ul>${checks}</ul>` : ""}
  ${imgs.length ? `<h2>${e(J("ho_photos"))}</h2><div class="photos">${imgs.map((p) => `<figure><img src="${p.src}" alt=""><figcaption>${e(J("p_" + p.slot))}</figcaption></figure>`).join("")}</div>` : ""}
  ${co.install_warranty_years ? `<p class="note">${e(J("ho_warranty", { n: co.install_warranty_years }))}</p>` : ""}
  ${service ? `<div class="svc"><div class="qr">${service.svg}</div><div><b>${e(J("ho_service_h"))}</b><br>${e(J("ho_service_p", { company }))}<br><span class="note">${e(service.url)}</span></div></div>` : ""}
  <div class="sign">
    <div><b>${e(J("ho_installer"))}</b><br>${e(company)}<br><span class="note">${e(J("ho_date"))}: ${e(today)}</span></div>
    <div><b>${e(J("ho_signed"))}</b><br>${rec.signature ? `<img src="${rec.signature.png}" alt="">${e(client)}<br><span class="note">${e(J("ho_date"))}: ${e(day(rec.signature.at))}</span>` : `<span class="note">${e(J("ho_unsigned"))}</span>`}</div>
  </div>
  </body></html>`;

  try {
    const pdf = await renderHtmlPdf(html);
    const name = `predare-${String(project.client_name || project.title || "lucrare").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40)}.pdf`;
    return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}"`, "cache-control": "no-store" } });
  } catch (err) {
    console.error("[handover-pdf]", err?.message);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }
}
