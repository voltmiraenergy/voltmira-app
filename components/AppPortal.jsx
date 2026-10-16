"use client";
// components/AppPortal.jsx — draws a modal at the root of the app instead of
// where it is used. Sections animate in with a transform (dx.css), and a
// transformed ancestor traps a position:fixed overlay inside it: the dark
// backdrop then covers only that section and the dialog lands off-screen.
// Rendered after mount, so the server and the first client render agree.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function AppPortal({ children }) {
  const [host, setHost] = useState(null);
  useEffect(() => { setHost(document.querySelector(".app") || document.body); }, []);
  return host ? createPortal(children, host) : null;
}
