// app/(app)/admin/AdminNav.jsx — the platform admin's three screens, one line.
import Link from "next/link";
import { at } from "../../../lib/adminText.js";

export default function AdminNav({ lang, here }) {
  const links = [["/traction", "ad_traction"], ["/admin/tariffs", "ad_tariffs"], ["/admin/subsidies", "ad_programs"]];
  return (
    <nav className="adm-nav" aria-label="Admin">
      {links.map(([href, key]) => (
        <Link key={href} href={href} className={"adm-tab" + (here === href ? " on" : "")} aria-current={here === href ? "page" : undefined}>{at(key, lang)}</Link>
      ))}
    </nav>
  );
}

export const ADMIN_CSS = `
.adm{max-width:1100px}
.adm-nav{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
.adm-tab{padding:7px 14px;border-radius:99px;border:1px solid var(--line);text-decoration:none;font-weight:600;font-size:13.5px;color:var(--muted)}
.adm-tab{background:none;cursor:pointer;font-family:inherit}
.adm-tab.on{background:var(--amber);color:var(--on-amber);border-color:var(--amber)}
.adm-card{background:var(--paper-2);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:16px}
.adm-card h2{margin:0 0 4px;font-size:17px}
.adm-card > p{margin:0 0 12px;color:var(--muted);font-size:13.5px}
.adm-warn{background:var(--amber-tint,#FBF0DD);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:14px}
.adm-seg{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.adm-table{width:100%;border-collapse:collapse;font-size:13.5px}
.adm-table th,.adm-table td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.adm-table th{font-size:12px;color:var(--muted);font-weight:600}
.adm-table td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.adm-scroll{overflow-x:auto}
.adm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.adm-months{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}
.adm-f{display:grid;gap:5px;font-size:13px;font-weight:600;min-width:0}
.adm-f input,.adm-f select,.adm-f textarea{width:100%;min-width:0;box-sizing:border-box;min-height:38px;padding:7px 10px;border-radius:9px;border:1.5px solid var(--line);background:var(--paper-2);color:var(--ink);font:inherit;font-weight:500}
.adm-f.bad input,.adm-f.bad select{border-color:#C4543B}
.adm-checks{display:flex;gap:14px;flex-wrap:wrap;font-size:13.5px}
.adm-checks label{display:flex;gap:6px;align-items:center}
.adm-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}
.adm-msg{font-size:13.5px;font-weight:600}
.adm-msg.ok{color:var(--green)}
.adm-msg.bad{color:#C4543B}
.adm-diff td.b{color:var(--muted);text-decoration:line-through}
.adm-doc{display:grid;grid-template-columns:140px repeat(4,minmax(0,1fr)) auto;gap:6px;align-items:end;margin-bottom:6px}
@media (max-width:760px){.adm-doc{grid-template-columns:1fr 1fr}}
`;
