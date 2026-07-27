/**
 * Central, validated access to the app's runtime configuration.
 *
 * Single-user app: values come from env vars, read once. Server-only — never
 * import this from a client component (it would leak APP_PIN / GEMINI_API_KEY).
 */

import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export const config = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  get appPin() {
    return required("APP_PIN");
  },
  /** Voice-capture backend — see the registry in src/lib/interpreter.ts. */
  get captureProvider() {
    return optional("CAPTURE_PROVIDER", "gemini");
  },
  /** Model for the Gemini backend — see src/lib/interpreters/gemini.ts. */
  get geminiModel() {
    return optional("GEMINI_MODEL", "gemini-flash-lite-latest");
  },
  /**
   * How hard the Gemini backend is allowed to think. Validated against the SDK
   * enum where it is used — see src/lib/interpreters/gemini.ts.
   */
  get geminiThinkingLevel() {
    return optional("GEMINI_THINKING_LEVEL", "MINIMAL");
  },
  /** Timezone used to resolve spoken relative dates to an absolute date. */
  get serverTz() {
    return optional("SERVER_TZ", "America/New_York");
  },
  // The self-confirm delay is a client-side build-tune — see SELF_CONFIRM_MS in
  // src/lib/drafts.ts (NEXT_PUBLIC_SELF_CONFIRM_MS), not read on the server.
};
