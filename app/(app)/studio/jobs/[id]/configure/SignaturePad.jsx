"use client";
// SignaturePad.jsx — a real freehand canvas signature, pointer-events driven
// (mouse, touch and pen all fire the same pointer* events), saved as a PNG
// data URL the same way photos.js already saves a captured photo. Uncontrolled
// by design: it takes `initialValue` (drawn once, on mount) rather than a
// live-controlled `value`, since a parent re-render must never repaint over
// an in-progress stroke.
import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export default function SignaturePad({ initialValue, onChange, height = 140, placeholder, clearLabel }) {
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
    ctx.strokeStyle = "#0F172A";
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
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    ctxRef.current.clearRect(0, 0, rect.width, rect.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-white dark:border-[#3A3A3A] dark:bg-white">
        <canvas ref={canvasRef} style={{ height, touchAction: "none" }} className="block w-full cursor-crosshair"
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400">
            {placeholder}
          </div>
        )}
      </div>
      {!empty && (
        <button type="button" onClick={clear}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-[#8A8A8A] dark:hover:text-[#D4D4D4]">
          <Eraser className="h-3.5 w-3.5" /> {clearLabel}
        </button>
      )}
    </div>
  );
}
