"use client";
// PhotoCapture.jsx — two small photo-capture widgets sharing photos.js: a
// named slot (Site & Roof: roof, board, meter, access; one photo each) and an
// open gallery (Installation: as many as the fitter takes). Tap to take or
// pick a photo, or drop one on the tile.
import { useRef, useState } from "react";
import { Camera, X, Upload } from "lucide-react";
import { readImageAsDataUrl, loadPhotos, savePhotos } from "../../../photos.js";

function useDrop(ingest) {
  const [over, setOver] = useState(false);
  return {
    over,
    handlers: {
      onDragOver: (e) => { e.preventDefault(); setOver(true); },
      onDragLeave: () => setOver(false),
      onDrop: (e) => { e.preventDefault(); setOver(false); ingest(e.dataTransfer.files?.[0]); },
    },
  };
}

export function PhotoSlot({ jobId, group, label, icon: Icon = Camera }) {
  const [list, setList] = useState(() => loadPhotos(jobId, group));
  const inputRef = useRef(null);
  const photo = list[0] || null;

  async function ingest(file) {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setList([dataUrl]);
      savePhotos(jobId, group, [dataUrl]);
    } catch { /* not an image, or the read failed: the slot just stays empty */ }
  }
  const drop = useDrop(ingest);

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="ws-hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; ingest(f); }} />
      {photo ? (
        <div className="ws-photo">
          <img src={photo} alt={label} />
          <div className="ws-photo-cap">{label}</div>
          <button type="button" className="ws-photo-del" aria-label={label}
            onClick={() => { setList([]); savePhotos(jobId, group, []); }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <button type="button" className={"ws-drop" + (drop.over ? " over" : "")} onClick={() => inputRef.current?.click()} {...drop.handlers}>
          <i aria-hidden="true">{drop.over ? <Upload size={16} /> : <Icon size={16} />}</i>
          {label}
        </button>
      )}
    </div>
  );
}

export function PhotoGallery({ jobId, group, addLabel }) {
  const [list, setList] = useState(() => loadPhotos(jobId, group));
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
  const drop = useDrop(ingest);
  function remove(i) {
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    savePhotos(jobId, group, next);
  }

  return (
    <div className="ws-photos gallery">
      {list.map((src, i) => (
        <div key={i} className="ws-photo">
          <img src={src} alt="" />
          <button type="button" className="ws-photo-del" aria-label="Remove" onClick={() => remove(i)}><X size={14} /></button>
        </div>
      ))}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="ws-hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; ingest(f); }} />
      <button type="button" className={"ws-drop" + (drop.over ? " over" : "")} onClick={() => inputRef.current?.click()} {...drop.handlers}>
        <i aria-hidden="true">{drop.over ? <Upload size={16} /> : <Camera size={16} />}</i>
        {addLabel}
      </button>
    </div>
  );
}
