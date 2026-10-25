"use client";
// app/s/[token]/ReportForm.jsx — the client's form: what happened, a description, name and phone, up to 4 photos
// (shrunk on the phone before sending), the bot check (Turnstile, when set up). POST /api/service/[token].
import { useEffect, useRef, useState } from "react";
import { svt } from "../../../lib/serviceText.js";
import { REQUEST_KINDS } from "../../../lib/service.js";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TYPES = ["image/jpeg", "image/png", "image/webp"];

// a photo from a phone camera is often 5 to 10 MB: shrink it to 2048 px JPEG before it goes
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export default function ReportForm({ lang, token, company, name }) {
  const V = (k, v) => svt(k, lang, v);
  const [f, setF] = useState({ kind: "", description: "", contact_name: name, contact_phone: "" });
  const [photos, setPhotos] = useState([]);
  const [state, setState] = useState("idle");
  const [err, setErr] = useState("");
  const tsRef = useRef(null), tsWidget = useRef(null), tsToken = useRef("");
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || state === "sent") return;
    function render() {
      if (!tsRef.current || tsWidget.current !== null || !window.turnstile) return;
      tsWidget.current = window.turnstile.render(tsRef.current, {
        sitekey: TURNSTILE_SITE_KEY, language: lang, theme: "light",
        callback: (tok) => { tsToken.current = tok; }, "expired-callback": () => { tsToken.current = ""; }, "error-callback": () => { tsToken.current = ""; },
      });
    }
    if (window.turnstile) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = render;
    document.head.appendChild(s);
    return () => { tsWidget.current = null; };
  }, [lang, state]);

  if (state === "sent") return <section className="sr-sent" role="status"><h2>{V("cp_sent_h")}</h2><p>{V("cp_sent_p", { company })}</p></section>;

  async function pick(list) {
    setErr("");
    const files = [...(list || [])];
    if (files.length + photos.length > 4 || files.some((x) => !TYPES.includes(x.type))) { setErr(V("cp_e_photo")); return; }
    const small = await Promise.all(files.map(shrink));
    if (small.some((x) => x.size > 8 * 1024 * 1024)) { setErr(V("cp_e_photo")); return; }
    setPhotos([...photos, ...small]);
  }

  async function send(e) {
    e.preventDefault();
    setErr("");
    if (!f.kind || f.description.trim().length < 5 || !f.contact_phone.trim()) { setErr(V("cp_e_fields")); return; }
    setState("sending");
    const body = new FormData();
    for (const [k, v] of Object.entries(f)) body.append(k, v);
    body.append("captcha", tsToken.current || "");
    photos.forEach((p) => body.append("photos", p));
    try {
      const r = await fetch(`/api/service/${token}`, { method: "POST", body });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setState("sent"); return; }
      setState("idle");
      setErr(j.error === "invalid" ? V("cp_e_fields") : j.error === "photo" ? V("cp_e_photo") : V("cp_e_send"));
      if (TURNSTILE_SITE_KEY && window.turnstile && tsWidget.current !== null) { try { window.turnstile.reset(tsWidget.current); } catch { /* a fresh check next time */ } tsToken.current = ""; }
    } catch { setState("idle"); setErr(V("cp_e_send")); }
  }

  return (
    <form className="sr-form" onSubmit={send} noValidate>
      <fieldset className="sr-kinds">
        <legend>{V("cp_kind")}</legend>
        {REQUEST_KINDS.map((k) => (
          <label key={k} className={"sr-kind" + (f.kind === k ? " on" : "")}>
            <input type="radio" name="kind" value={k} checked={f.kind === k} onChange={() => setF({ ...f, kind: k })} />{V("rk_" + k)}
          </label>
        ))}
      </fieldset>
      <label className="sr-field" htmlFor="srDesc">{V("cp_desc")}
        <textarea id="srDesc" rows={4} maxLength={2000} placeholder={V("cp_desc_ph")} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <div className="sr-two">
        <label className="sr-field" htmlFor="srName">{V("cp_name")}<input id="srName" maxLength={120} autoComplete="name" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></label>
        <label className="sr-field" htmlFor="srPhone">{V("cp_phone")}<input id="srPhone" type="tel" inputMode="tel" maxLength={24} autoComplete="tel" value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></label>
      </div>
      <div className="sr-field">
        <span>{V("cp_photos")}</span>
        <div className="sr-photos">
          {photos.map((p, i) => <button key={i} type="button" className="sr-photo" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>{i + 1}. {p.name} x</button>)}
          {photos.length < 4 && <label className="pay-copy sr-add"><input type="file" accept={TYPES.join(",")} multiple className="sr" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />+</label>}
        </div>
      </div>
      {TURNSTILE_SITE_KEY && <div ref={tsRef} />}
      {err && <p className="pay-err" role="alert">{err}</p>}
      <button type="submit" className="pay-btn sr-send" disabled={state === "sending"} aria-busy={state === "sending"}>{state === "sending" ? V("cp_sending") : V("cp_send")}</button>
    </form>
  );
}
