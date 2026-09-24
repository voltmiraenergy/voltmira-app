"use client";
// PhotoCapture.jsx — two small real photo-capture widgets sharing photos.js.
// Replaces two decorative stand-ins from the old tool pages: Survey's 4
// boolean toggle buttons and Schedule's 4 static gradient boxes — neither
// ever captured an actual file.
import { useRef, useState } from "react";
import { Camera, X, Upload } from "lucide-react";
import { readImageAsDataUrl, loadPhotos, savePhotos } from "../../../photos.js";

// A single named slot (Site & Roof: roof / board / meter / access) — one
// photo each, tap OR drag-and-drop to capture or replace. `icon` is the
// category glyph (Roof/Electrical panel/Meter/Facade each get their own,
// not one generic camera for all four).
export function PhotoSlot({ jobId, group, label, icon: Icon = Camera }) {
  const [list, setList] = useState(() => loadPhotos(jobId, group));
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const photo = list[0] || null;

  async function ingest(file) {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setList([dataUrl]);
      savePhotos(jobId, group, [dataUrl]);
    } catch { /* not an image, or the read failed — no crash, slot just stays empty */ }
  }
  function onFile(e) { const file = e.target.files?.[0]; e.target.value = ""; ingest(file); }
  function onDrop(e) { e.preventDefault(); setDragOver(false); ingest(e.dataTransfer.files?.[0]); }
  function remove(e) { e.stopPropagation(); setList([]); savePhotos(jobId, group, []); }

  return (
    <div className="relative">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      {photo ? (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-[#2C2C2C]">
          <img src={photo} alt={label} className="aspect-square w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2 text-[11px] font-medium text-white">{label}</div>
          <button type="button" onClick={remove}
            className="ws-fill-dark absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={"flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors " +
            (dragOver ? "ws-fill-brand-tint border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10"
              : "ws-fill-slate border-slate-200 bg-slate-50/60 text-slate-400 hover:border-brand-300 hover:bg-brand-50/50 dark:border-[#2C2C2C] dark:bg-[#242424]/40 dark:hover:border-brand-500/40")}>
          <span className={"flex h-9 w-9 items-center justify-center rounded-full " + (dragOver ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300" : "bg-white text-slate-400 shadow-sm dark:bg-[#2C2C2C] dark:text-[#B0B0B0]")}>
            {dragOver ? <Upload className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </span>
          <span className="px-1 text-[11px] font-semibold leading-tight text-slate-500 dark:text-[#B0B0B0]">{label}</span>
        </button>
      )}
    </div>
  );
}

// An open gallery (Installation: however many on-site photos the fitter takes).
export function PhotoGallery({ jobId, group }) {
  const [list, setList] = useState(() => loadPhotos(jobId, group));
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function ingest(file) {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const next = [...list, dataUrl];
      setList(next);
      savePhotos(jobId, group, next);
    } catch { /* ignore */ }
  }
  function onFile(e) { const file = e.target.files?.[0]; e.target.value = ""; ingest(file); }
  function onDrop(e) { e.preventDefault(); setDragOver(false); ingest(e.dataTransfer.files?.[0]); }
  function remove(i) {
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    savePhotos(jobId, group, next);
  }

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {list.map((src, i) => (
        <div key={i} className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-[#2C2C2C]">
          <img src={src} alt="" className="aspect-square w-full object-cover" />
          <button type="button" onClick={() => remove(i)}
            className="ws-fill-dark absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <button type="button" onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={"flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition-colors " +
          (dragOver ? "ws-fill-brand-tint border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-300"
            : "ws-fill-slate border-slate-200 bg-slate-50/60 text-slate-400 hover:border-brand-300 hover:bg-brand-50/50 dark:border-[#2C2C2C] dark:bg-[#242424]/40 dark:hover:border-brand-500/40")}>
        {dragOver ? <Upload className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
      </button>
    </div>
  );
}
