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
  return process.env[name] ?? fallback;
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
  /** Timezone used to resolve spoken relative dates to an absolute date. */
  get serverTz() {
    return optional("SERVER_TZ", "America/New_York");
  },
  /** Delay (ms) before an untouched capture draft self-confirms. */
  get selfConfirmMs() {
    return Number(optional("SELF_CONFIRM_MS", "4000"));
  },
};
