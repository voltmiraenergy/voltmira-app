// app/(app)/template.jsx — unlike layout, a template re-mounts on every
// navigation, so the .view entrance animation (viewIn, defined in AppTheme)
// replays per page — exactly like the demo re-rendering #view on route().
export default function Template({ children }) {
  return <div className="view">{children}</div>;
}
