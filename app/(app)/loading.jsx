// app/(app)/loading.jsx — shown INSTANTLY on every navigation inside the app
// while the page's server data streams in. The sidebar (layout) stays put, so a
// click paints a full shell immediately instead of a blank wait — the main
// reason the app felt slower than the static demo even when data was quick.
const LOAD_CSS = `
@keyframes vm-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.vm-load-head{display:flex;align-items:center;gap:12px;margin:0 0 18px}
.vm-load-mark{width:30px;height:30px;flex:none}
.vm-load-mark path{animation:vm-load-pulse 1.2s ease-in-out infinite}
.vm-load-mark path:nth-of-type(2){animation-delay:.18s}
.vm-load-mark path:nth-of-type(3){animation-delay:.36s}
.vm-load-band{display:flex;gap:4px;width:110px;height:4px}
.vm-load-band i{flex:1;border-radius:99px;background:var(--line);position:relative;overflow:hidden}
.vm-load-band i::after{content:"";position:absolute;inset:0;transform:scaleX(0);transform-origin:left;animation:vm-load-fill 1.2s ease-in-out infinite}
.vm-load-band i:nth-child(1)::after{background:#C4543B}
.vm-load-band i:nth-child(2)::after{background:#E89B2D;animation-delay:.18s}
.vm-load-band i:nth-child(3)::after{background:#3FAE6A;animation-delay:.36s}
@keyframes vm-load-pulse{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes vm-load-fill{0%{transform:scaleX(0)}50%{transform:none}100%{transform:none;opacity:0}}
@media (prefers-reduced-motion: reduce){.vm-load-mark path,.vm-load-band i::after{animation:none}}
`;

export default function Loading() {
  const bar = (w, h = 14) => ({
    width: w, height: h, borderRadius: 7,
    background: "linear-gradient(90deg, var(--line) 25%, var(--paper-2) 50%, var(--line) 75%)",
    backgroundSize: "200% 100%", animation: "vm-shimmer 1.2s ease-in-out infinite",
  });
  const card = {
    background: "var(--paper-2)", border: "1px solid var(--line)",
    borderRadius: 14, padding: 18,
  };
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }} aria-busy="true">
      <style>{LOAD_CSS}</style>
      {/* the brand while it loads: the mark's three strokes pulse in turn, and a red, amber, green band runs */}
      <div className="vm-load-head">
        <svg className="vm-load-mark" viewBox="0 0 34 34" fill="none" aria-hidden="true">
          <rect width="34" height="34" rx="8" fill="#142A21" />
          <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <div className="vm-load-band" aria-hidden="true"><i /><i /><i /></div>
      </div>
      <div style={bar(200, 26)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, margin: "22px 0" }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={card}>
            <div style={bar("55%", 22)} />
            <div style={{ ...bar("40%", 11), marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div style={{ ...card, marginBottom: 16 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ ...bar("40%"), flex: 1 }} />
            <div style={bar(60)} />
            <div style={bar(70)} />
          </div>
        ))}
      </div>
    </div>
  );
}
