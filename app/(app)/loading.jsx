// app/(app)/loading.jsx — shown INSTANTLY on every navigation inside the app
// while the page's server data streams in. The sidebar (layout) stays put, so a
// click paints a full shell immediately instead of a blank wait — the main
// reason the app felt slower than the static demo even when data was quick.
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
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <style>{"@keyframes vm-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}"}</style>
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
