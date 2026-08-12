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
  {
    ignores: ["node_modules/**", ".next/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
