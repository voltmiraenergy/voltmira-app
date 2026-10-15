// lib/smoothJump.js — the on-page tabs glide to their section instead of
// jumping, and the section they land on is marked for a moment so the eye
// finds it. Browser only; with "reduce motion" it still lands, without gliding.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let raf = 0;

/** @param {Element} el  @param {{ offset?: number, ms?: number }} [o] */
export function glideTo(el, { offset = 56, ms } = {}) {
  cancelAnimationFrame(raf);
  const from = window.scrollY;
  const to = Math.max(0, Math.round(el.getBoundingClientRect().top + from - offset));
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const land = () => { el.classList.remove("pf-landed"); void el.offsetWidth; el.classList.add("pf-landed"); setTimeout(() => el.classList.remove("pf-landed"), 1400); };
  if (still || Math.abs(to - from) < 4) { window.scrollTo(0, to); land(); return; }
  // a longer way takes a little longer, never more than 0.9 s
  const dur = ms || Math.min(900, 380 + Math.abs(to - from) * 0.12);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    window.scrollTo(0, from + (to - from) * ease(t));
    if (t < 1) raf = requestAnimationFrame(step); else land();
  };
  // a wheel or touch during the glide hands control back
  const stop = () => cancelAnimationFrame(raf);
  window.addEventListener("wheel", stop, { once: true, passive: true });
  window.addEventListener("touchstart", stop, { once: true, passive: true });
  raf = requestAnimationFrame(step);
}
