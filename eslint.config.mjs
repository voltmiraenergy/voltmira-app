// eslint.config.mjs — Next.js's recommended rules (React, hooks, accessibility,
// Core Web Vitals). Run with `npm run lint`.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

export default defineConfig([
  ...nextVitals,
  {
    // These four check that a component is safe for the React Compiler, which
    // this app does not use. What they flag here (Date.now() in a server page,
    // reading saved state on mount, a running total inside one render) is
    // correct without it. Kept visible as warnings for the day it is turned on.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // A name used but never defined crashes a route at runtime and nothing else
    // catches it (a ReferenceError in /api/portfolios/[id]/pack did, 2026-10-10).
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.es2024 } },
    rules: { "no-undef": "error" },
  },
  globalIgnores([".next/**", "node_modules/**", "public/**", "scripts/**", "engine/node_modules/**"]),
]);
