"use client";
// SignaturePad.jsx — a freehand canvas signature, pointer-events driven (mouse,
// touch and pen fire the same events), saved as a PNG data URL the way
// photos.js saves a photo. Uncontrolled by design: it takes `initialValue`
// (drawn once, on mount) rather than a live `value`, so a parent re-render
// can never repaint over a stroke in progress. The pad stays white in dark
// mode, like paper: the ink is dark and the saved image must print.
import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export default function SignaturePad({ initialValue, onChange, height = 150, placeholder, clearLabel }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(!initialValue);

  useEffect(() => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#142A21";
    ctxRef.current = ctx;
    if (initialValue) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = initialValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function posFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e) {
    e.preventDefault();
    drawing.current = true;
    last.current = posFromEvent(e);
    canvasRef.current.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!drawing.current) return;
    const pos = posFromEvent(e);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
    if (empty) setEmpty(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }
  function clear() {
    const rect = canvasRef.current.getBoundingClientRect();
    ctxRef.current.clearRect(0, 0, rect.width, rect.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="ws-sec">
      <div className="ws-sign">
        <canvas ref={canvasRef} style={{ height, touchAction: "none" }}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
        {empty && <div className="ws-sign-ph">{placeholder}</div>}
      </div>
      {!empty && (
        <button type="button" onClick={clear} className="ws-link"><Eraser size={14} aria-hidden="true" /> {clearLabel}</button>
      )}
    </div>
  );
}
