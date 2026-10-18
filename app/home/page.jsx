// app/home/page.jsx — a homeowner's systems (docs/MARKETPLACE.md): straight
// to the one they have, or a list when there are several.
import { redirect } from "next/navigation";
import { supabaseAdmin } from "../../lib/supabase.js";
import { currentHomeowner } from "../../lib/homeServer.js";
import { homeownerProjects } from "../../lib/homeownerFlow.js";
import { normLang } from "../../lib/i18n.js";
import { ht } from "../../lib/homeText.js";
import HtmlLang from "../../lib/HtmlLang.jsx";
import "../p/[code]/proposal.css";
import "./home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "VoltMira", robots: { index: false, follow: false, nocache: true } };

export default async function HomeIndex() {
  const user = await currentHomeowner();
  if (!user) redirect("/home/login");
  const db = supabaseAdmin();
  const { needsDb, links } = await homeownerProjects(db, user.id);
  if (links.length === 1) redirect(`/home/${links[0].project_id}`);
  const ids = links.map((l) => l.project_id);
  const [{ data: projects }, { data: cos }] = await Promise.all([
    ids.length ? db.from("projects").select("id, title, address, kw, company_id").in("id", ids) : { data: [] },
    ids.length ? db.from("companies").select("id, name, short_name, lang").in("id", [...new Set(links.map((l) => l.company_id))]) : { data: [] },
  ]);
  const lang = normLang(cos?.[0]?.lang || "ro");
  const coName = new Map((cos || []).map((c) => [c.id, c.short_name || c.name]));

  return (
    <main className="pp hm" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap hm-wrap">
        <header className="hm-top">
          <h1 className="pp-h2">{ht("hm_pick", lang)}</h1>
          <form action="/home/signout" method="post"><button type="submit" className="pp-btn pp-btn-text">{ht("hm_signout", lang)}</button></form>
        </header>
        {needsDb ? <p className="pp-lead">{ht("hm_needs_db", lang)}</p> : !projects?.length ? <p className="pp-lead">{ht("hm_none", lang)}</p> : (
          <ul className="hm-list">
            {projects.map((p) => (
              <li key={p.id}>
                <a className="pp-card hm-pick" href={`/home/${p.id}`}>
                  <b>{p.title || p.address}</b>
                  <span>{ht("hm_by", lang, { co: coName.get(p.company_id) || "" })}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
