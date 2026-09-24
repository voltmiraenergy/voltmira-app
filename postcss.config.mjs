// postcss.config.mjs — only processes real .css files. Nothing in the app
// imports one today except app/(app)/studio/jobs/[id]/configure/workspace.css
// (the new Tailwind-powered Studio workspace), so this is additive: it can't
// touch the existing <style dangerouslySetInnerHTML> styling used everywhere
// else in the app.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
