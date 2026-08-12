import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Most test files boot their own PGlite (Postgres compiled to WASM) in a
    // hook. Running the files in parallel puts enough pressure on a loaded
    // machine that startup alone approaches the 5s default, which showed up as
    // tests timing out in the full run while passing in isolation. These are
    // ceilings for a hung test, not expected durations.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js provides this alias at build time; stub it for node tests.
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
