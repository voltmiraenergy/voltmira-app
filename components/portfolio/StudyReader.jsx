"use client";
// components/portfolio/StudyReader.jsx — read a wind or solar energy yield
// study from its PDF, in the plant editor. The PDF is opened in the browser
// (unpdf); the pages with the results are picked there (lib/studyPages.js) and
// only their text is sent to /api/plant-study. A scan has no text, so the user
// types the pages to read and pdf-lib cuts them into a small PDF. Every value
// comes back with its page, the words it was read from and whether those words
// were found on that page; the user ticks what to use. Nothing is applied
// without that.
import { useRef, useState } from "react";
import { pickPages, hasTextLayer, parseRange } from "../../lib/studyPages.js";
import { plt } from "../../lib/plantText.js";
import { num as fnum, mwhUnit } from "../../lib/portfolioFormat.js";

const ROWS = {
  wind: ["p50", "p90_1y", "p90_10y", "capacity", "turbines", "hub", "meanWind", "losses", "uncertainty", "model", "measurement", "by", "date"],
  solar: ["p50", "p90_1y", "p90_10y", "capacity", "losses", "uncertainty", "measurement", "by", "date"],
};
const LABEL = { p50: "rf_p50", p90_1y: "rf_p90_1y", p90_10y: "rf_p90_10y", capacity: "rf_capacity", turbines: "w_turbines", hub: "w_hub",
  meanWind: "rf_meanWind", losses: "rf_losses", uncertainty: "rf_uncertainty", model: "rf_model", measurement: "rf_measurement", by: "s_by", date: "s_date" };
/** The values that go into the plant; the rest is shown for information. */
const USABLE = ["p50", "by", "date", "hub", "turbines"];
const CHECK = { verified: "rd_ok", quote_only: "rd_quote_only", unverified: "rd_unverified", scan: "rd_scan_src" };

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function StudyReader({ kind, id, lang = "en", plantMw = null, onApply }) {
  const [stage, setStage] = useState("idle");   // idle | opening | reading | scan | review | applied
  const [err, setErr] = useState(null);
  const [fileName, setFileName] = useState("");
  const [total, setTotal] = useState(0);
  const [picked, setPicked] = useState([]);
  const [range, setRange] = useState("");
  const [rangeBad, setRangeBad] = useState(false);
  const [study, setStudy] = useState(null);
  const [ticks, setTicks] = useState({});
  const [p90, setP90] = useState("1y");
  const bytes = useRef(null);
  const inputRef = useRef(null);
  const busy = stage === "opening" || stage === "reading";

  function reset() {
    setStage("idle"); setErr(null); setStudy(null); setRange(""); setRangeBad(false); bytes.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  async function send(body) {
    const res = await fetch("/api/plant-study", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, fileName, plant: { mw: plantMw }, lang, ...body }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok || !j?.ok) { setStage("idle"); setErr(j?.error || "failed"); return; }
    const st = j.study;
    const capWarn = st.warnings.some((w) => w.id === "cap");
    setTicks({ p50: true, by: !!st.fields.by, date: !!st.isoDate, hub: !!st.fields.hub && !capWarn, turbines: !!st.fields.turbines && !capWarn });
    setP90(st.fields.p90_1y ? "1y" : st.fields.p90_10y ? "10y" : "");
    setStudy(st); setStage("review");
  }

  async function onFile(file) {
    if (!file) return;
    reset();
    setFileName(file.name); setStage("opening");
    let texts;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      bytes.current = buf;
      const { getDocumentProxy, extractText } = await import("unpdf");
      // pdf.js may take over the buffer it is given: hand it a copy
      const doc = await getDocumentProxy(buf.slice());
      const r = await extractText(doc, { mergePages: false });
      texts = r.text; setTotal(r.totalPages);
    } catch {
      setStage("idle"); setErr("open"); return;
    }
    if (!hasTextLayer(texts)) { setStage("scan"); return; }
    const list = pickPages(texts);
    setPicked(list); setStage("reading");
    await send({ pages: list.map((n) => ({ n, text: texts[n - 1] })) });
  }

  async function readScan() {
    const list = parseRange(range, total);
    if (!list) { setRangeBad(true); return; }
    setRangeBad(false); setErr(null); setPicked(list); setStage("reading");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const src = await PDFDocument.load(bytes.current, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      (await out.copyPages(src, list.map((n) => n - 1))).forEach((p) => out.addPage(p));
      const cut = await out.save();
      if (cut.length > 3 * 1024 * 1024) { setStage("scan"); setErr("too_large"); return; }
      await send({ pdf: toBase64(cut), pageMap: list });
    } catch {
      setStage("scan"); setErr("open");
    }
  }

  function apply() {
    const f = study.fields;
    const s = { file: fileName, pages: { p50: null, p90: null } };
    if (ticks.p50) { s.p50Mwh = f.p50.value; s.pages.p50 = f.p50.page; }
    const pf = p90 === "10y" ? f.p90_10y : p90 === "1y" ? f.p90_1y : null;
    if (pf) { s.p90Mwh = pf.value; s.p90Basis = p90; s.pages.p90 = pf.page; }
    if (ticks.by && f.by) s.by = f.by.value;
    if (ticks.date && study.isoDate) s.date = study.isoDate;
    const extra = {};
    if (kind === "wind" && ticks.hub && f.hub) extra.hubM = f.hub.value;
    if (kind === "wind" && ticks.turbines && f.turbines) extra.turbines = f.turbines.value;
    onApply({ study: s, extra });
    setStudy(null); setStage("applied");
    if (inputRef.current) inputRef.current.value = "";
  }

  const show = (key, v) => {
    if (key === "p50" || key === "p90_1y" || key === "p90_10y") return `${fnum(v, lang, 0)} ${mwhUnit(lang)}`;
    if (key === "capacity") return `${fnum(v, lang, 2)} ${kind === "solar" ? "MWp" : "MW"}`;
    if (key === "losses" || key === "uncertainty") return `${fnum(v, lang, 1)}%`;
    if (typeof v === "number") return fnum(v, lang, 2);
    return v;
  };
  const warnText = (w) => {
    if (w.id === "cap") return plt("rw_cap", lang, { s: `${fnum(w.study, lang, 2)} ${kind === "solar" ? "MWp" : "MW"}`, p: `${fnum(w.plant, lang, 2)} ${kind === "solar" ? "MWp" : "MW"}` });
    if (w.id === "cf") return plt("rw_cf", lang, { cf: `${fnum(w.cf * 100, lang, 1)}%`, lo: `${fnum(w.lo * 100, lang, 0)}%`, hi: `${fnum(w.hi * 100, lang, 0)}%` });
    if (w.id === "unchecked") return plt("rw_unchecked", lang, { n: w.n });
    return plt("rw_" + w.id, lang);
  };

  return (
    <div className="yr">
      <div className="pl-row">
        <label className={"btn sm" + (busy ? " off" : "")} htmlFor={`yr-${kind}-${id}`}>
          {plt("rd_btn", lang)}
          <input ref={inputRef} id={`yr-${kind}-${id}`} className="yr-file" type="file" accept="application/pdf,.pdf" disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {stage === "opening" && <small className="pf-hint" role="status">{plt("rd_opening", lang)}</small>}
        {stage === "reading" && <small className="pf-hint" role="status">{plt("rd_reading", lang, { pages: picked.join(", "), total })}</small>}
        {stage === "applied" && <small className="pl-line ok" role="status">{plt("rd_applied", lang)}</small>}
      </div>
      {stage === "idle" && !err && <small className="pf-hint">{plt("rd_hint", lang)}</small>}
      {err && <p className="pf-warn" role="alert">{plt("rd_err_" + err, lang)}</p>}

      {stage === "scan" && (
        <div className="yr-scan">
          <label htmlFor={`yrr-${kind}-${id}`}>{plt("rd_scan", lang)}</label>
          <div className="pl-row">
            <input id={`yrr-${kind}-${id}`} className="input" value={range} onChange={(e) => setRange(e.target.value)} placeholder="4-9" inputMode="numeric" />
            <button type="button" className="btn sm" onClick={readScan}>{plt("rd_scan_go", lang)}</button>
            <button type="button" className="btn ghost sm" onClick={reset}>{plt("rd_cancel", lang)}</button>
          </div>
          {rangeBad && <small className="pf-warn" role="alert">{plt("rd_range_bad", lang, { total })}</small>}
        </div>
      )}

      {stage === "review" && study && (
        <div className="yr-review">
          <p className="pl-line">{plt("rd_found", lang, { file: fileName })}</p>
          {study.scan && <p className="pf-warn">{plt("rw_scan", lang)}</p>}
          {study.warnings.filter((w) => w.id !== "unchecked" || !study.scan).map((w) => <p key={w.id} className="pf-warn">{warnText(w)}</p>)}
          <ul className="yr-list" aria-label={plt("rd_col_value", lang)}>
            {ROWS[kind].filter((k) => study.fields[k]).map((k) => {
              const f = study.fields[k];
              const isP90 = k === "p90_1y" || k === "p90_10y";
              const basis = k === "p90_1y" ? "1y" : "10y";
              const usable = USABLE.includes(k) && !(k === "date" && !study.isoDate);
              const ctl = `yr-${kind}-${id}-${k}`;
              return (
                <li key={k} className={"yr-item" + (f.check === "verified" ? "" : " yr-chk")}>
                  <div className="yr-head">
                    {isP90 ? (
                      <label htmlFor={ctl} className="yr-pick">
                        <input id={ctl} type="radio" name={`yr-p90-${kind}-${id}`} checked={p90 === basis} onChange={() => setP90(basis)} />
                        <span>{plt(LABEL[k], lang)}<small>{plt("rd_p90_pick", lang)}</small></span>
                      </label>
                    ) : usable ? (
                      <label htmlFor={ctl} className="yr-pick">
                        <input id={ctl} type="checkbox" checked={!!ticks[k]} onChange={(e) => setTicks({ ...ticks, [k]: e.target.checked })} />
                        <span>{plt(LABEL[k], lang)}</span>
                      </label>
                    ) : (
                      <span className="yr-info">{plt(LABEL[k], lang)}<small>{plt("rd_info", lang)}</small></span>
                    )}
                    <b className="yr-val">{show(k, f.value)}</b>
                  </div>
                  <div className="yr-where">
                    <small className={"yr-c yr-c-" + f.check}>{f.page ? `${plt("rd_page", lang, { p: f.page })}, ` : ""}{plt(CHECK[f.check], lang)}</small>
                    {f.quote && <q>{f.quote}</q>}
                  </div>
                </li>
              );
            })}
          </ul>
          {study.notes && <p className="pf-hint">{plt("rd_notes", lang, { x: study.notes })}</p>}
          <div className="pl-row">
            <button type="button" className="btn primary sm" onClick={apply}>{plt("rd_apply", lang)}</button>
            <button type="button" className="btn ghost sm" onClick={reset}>{plt("rd_cancel", lang)}</button>
          </div>
        </div>
      )}
    </div>
  );
}
