"use client";
// components/RaionCard.jsx — "The job's area" on a Moldovan quote: which raion
// the picked address is in and what CNED's register says about it (prosumers,
// households, growth over 12 months, the place per 10,000 residents), with a
// switch to show ONE line of it in the client's offer.
//
// Installer-facing; mounted only while CNED_DATA is on (the quote page passes
// cnedOn). The figures come from /api/cned/raion for the quote's position, so
// nothing from CNED is bundled into the page. The switch is stored on the quote
// (projects.show_raion, supabase/add-show-raion.sql) and the line is frozen
// into the offer when it is generated, like every other figure there.
import "./support.css";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { setShowRaion } from "../lib/greenActions.js";
import { raionName } from "../lib/mdRaions.js";
import { ct, OPERATOR_NAME } from "../lib/cnedText.js";
import { num } from "../lib/portfolioFormat.js";
import { fmtDate } from "../lib/tz.js";
import { LOCALE } from "../lib/relTime.js";

const kw = (v, lang) => (v >= 1000 ? `${num(v / 1000, lang, 1)} ${lang === "ru" || lang === "uk" ? "МВт" : "MW"}` : `${num(v, lang, 0)} ${lang === "ru" || lang === "uk" ? "кВт" : "kW"}`);

export default function RaionCard({ projectId, lang = "en", lat, lon, initialShow = false }) {
  const [res, setRes] = useState(null);       // the answer for this position
  const [show, setShow] = useState(!!initialShow);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const has = lat != null && lon != null && Number.isFinite(+lat) && Number.isFinite(+lon);
  const key = has ? `${(+lat).toFixed(4)},${(+lon).toFixed(4)}` : "";

  useEffect(() => {
    if (!key) return;
    let gone = false;
    const [la, lo] = key.split(",");
    fetch(`/api/cned/raion?lat=${la}&lon=${lo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!gone) setRes(j ? { ...j, key } : { error: true, key }); })
      .catch(() => { if (!gone) setRes({ error: true, key }); });
    return () => { gone = true; };
  }, [key]);

  function toggle(on) {
    setShow(on); setNote(null);
    start(async () => {
      try {
        const r = await setShowRaion(projectId, on);
        if (!r?.ok) setNote(r?.needsDb ? "q_needs_db" : "q_failed");
      } catch { setNote("q_failed"); }
    });
  }

  const loc = LOCALE[lang] || "en-GB";
  const answer = res && res.key === key ? res : null;
  const b = answer?.brief;
  const date = answer?.dataTo ? fmtDate(answer.dataTo + "T12:00:00Z", loc, { day: "numeric", month: "long", year: "numeric" }).replace(/\.$/, "") : "";
  const clientLine = b ? ct("pp_line", lang, { raion: raionName(b.id, lang), h: num(b.householdsN, lang, 0) }) : "";

  return (
    <section className="card spc rc" aria-labelledby="rc-h" aria-busy={pending || (has && !answer)}>
      <h3 id="rc-h"><MapPin size={17} strokeWidth={1.9} aria-hidden="true" />{ct("q_h", lang)}{b ? `: ${raionName(b.id, lang)}` : ""}</h3>
      {!has ? (
        <p className="spc-dim">{ct("q_none", lang)}</p>
      ) : !answer ? (
        <p className="spc-dim">{ct("q_loading", lang)}</p>
      ) : !b ? (
        <p className="spc-dim">{ct("q_outside", lang)}</p>
      ) : (
        <>
          <p>{ct("q_line", lang, { n: num(b.prosumers.n, lang, 0), h: num(b.householdsN, lang, 0), kw: kw(b.prosumers.kw, lang) })}
            {b.growth12 ? ` ${ct("q_growth", lang, { n: num(b.growth12.n, lang, 0) })}` : ""}</p>
          {b.perTenK != null && <p className="spc-dim">{ct("q_rank", lang, { x: num(b.perTenK, lang, 1), r: b.rankPerTenK, t: answer.areas })}</p>}
          {b.operator && <p className="spc-dim">{ct("p_operator", lang, { op: OPERATOR_NAME[b.operator] })}</p>}
          <label className="rc-show">
            <input id={"rc-show-" + projectId} type="checkbox" checked={show} onChange={(e) => toggle(e.target.checked)} />
            <span>{ct("q_show", lang)}</span>
          </label>
          {show && <p className="rc-quote"><small>{ct("q_client_sees", lang)}</small> {clientLine} <small>({ct("pp_src", lang, { date })})</small></p>}
          {show && <p className="spc-dim">{ct("q_after_send", lang)}</p>}
          {note && <p className="spc-note bad" role="status">{ct(note, lang)}</p>}
          <p className="spc-foot">{ct("src", lang, { src: ct("src_cned", lang, { date }) })}. <Link className="dx-link" href="/energy#cned-map">{ct("q_open_map", lang)}</Link></p>
        </>
      )}
    </section>
  );
}
