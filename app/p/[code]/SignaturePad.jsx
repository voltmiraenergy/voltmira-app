"use client";
// app/p/[code]/SignaturePad.jsx — the homeowner draws their signature with a
// finger (or mouse/stylus) right on the proposal page.
//
// Details that matter on a phone:
//  - Pointer Events cover finger + stylus + mouse in one code path.
//  - touch-action:none stops the browser scrolling the page mid-stroke.
//  - the canvas is scaled by devicePixelRatio so the line is crisp on retina.
//  - setPointerCapture keeps the stroke alive if the finger leaves the box.
//
// Exports the drawing as a PNG data URL. Empty strokes are reported as empty so
// the caller can require an actual signature before accepting.
// Styles: proposal.css (.pp-pad).
import { useEffect, useRef, useState } from "react";

export default function SignaturePad({ onChange, label, clearLabel, hint = "", height = 170 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Size the backing store to the CSS box × DPR, then scale the context so we
  // can draw in CSS pixels. Re-runs on resize (phone rotation).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    function fit() {
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.getBoundingClientRect();
      if (!rect.width) return;
      // Preserve any existing ink across a resize.
      const prev = dirty.current ? cv.toDataURL("image/png") : null;
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(height * dpr);
      const ctx = cv.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#142A21";
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, height);
        img.src = prev;
      }
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [height]);

  function pos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e) {
    e.preventDefault();
    const cv = canvasRef.current;
    cv.setPointerCapture?.(e.pointerId);
    const { x, y } = pos(e);
    const ctx = cv.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    // a tap with no drag should still leave a mark
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    drawing.current = true;
    if (!dirty.current) { dirty.current = true; setHasInk(true); }
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  }
  function emit() {
    const cv = canvasRef.current;
    onChange?.(dirty.current ? cv.toDataURL("image/png") : "");
  }
  function clear() {
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    dirty.current = false;
    setHasInk(false);
    onChange?.("");
  }

  return (
    <div>
      <div className="pp-field-l">
        <span>{label}</span>
        {hasInk && (
          <button type="button" className="pp-btn pp-btn-text" style={{ minHeight: 32, color: "var(--green)", fontWeight: 600 }} onClick={clear}>
            {clearLabel}
          </button>
        )}
      </div>
      <div className="pp-pad">
        <canvas
          ref={canvasRef}
          aria-label={label}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}
          style={{ height }}
        />
        {!hasInk && hint && <span className="pp-pad-hint" aria-hidden="true">{hint}</span>}
      </div>
    </div>
  );
}
