import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Replaces the removed `next lint`. `next/core-web-vitals` + `next/typescript`
// are the rules `next lint` applied by default; ported to flat config so
// `npm run lint` (`eslint`) runs non-interactively in CI.
//
// As of eslint-config-next 16 these ship as native flat-config arrays, so they
// are spread directly. Routing them through `FlatCompat` instead throws
// "Converting circular structure to JSON".
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // eslint-plugin-react (vendored by eslint-config-next) auto-detects the React
  // version through `context.getFilename()`, which ESLint 10 removed — that
  // detection path throws "contextOrFilename.getFilename is not a function".
  // Naming the version skips detection entirely. Drop this once
  // eslint-config-next ships a plugin build that supports ESLint 10.
  { settings: { react: { version: "19.2" } } },
  {
    ignores: ["node_modules/**", ".next/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
