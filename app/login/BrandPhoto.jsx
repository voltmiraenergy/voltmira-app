"use client";
// app/login/BrandPhoto.jsx — the brand-pane photograph.
//
// A client component for one narrow reason: a server component's output is
// serialised a second time into the RSC flight payload, so the inlined image
// appeared TWICE in the prerendered /login document (~664 KB of base64). A
// client component is sent as a module reference instead, and the data URI —
// a module constant, not a prop — travels only in the JS chunk, which the
// browser caches. The rendered <img> is identical either way.
import { HERO_PHOTO } from "./hero-photo.js";

export default function BrandPhoto() {
  return <div className="bp-photo"><img src={HERO_PHOTO} alt="" /></div>;
}
