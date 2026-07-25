/**
 * Session token derivation — Edge- and Node-safe (Web Crypto only, no
 * server-only import) so both the middleware gate and the login route can use it.
 *
 * Single-user app: the session token is an HMAC of a fixed message keyed by the
 * PIN. Holding the token proves the PIN was known; rotating APP_PIN invalidates
 * every existing session. No separate session secret to manage.
 */

export const SESSION_COOKIE = "togo_session";
const MESSAGE = "togo-session-v1";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The session token a given PIN should produce. */
export async function sessionTokenFor(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(MESSAGE));
  return toHex(sig);
}

/** Constant-time-ish comparison of two hex tokens. */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Whether a presented cookie value is a valid session for this PIN. */
export async function isValidSession(
  token: string | undefined,
  pin: string | undefined,
): Promise<boolean> {
  if (!token || !pin) return false;
  return tokensMatch(token, await sessionTokenFor(pin));
}
