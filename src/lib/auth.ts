import "server-only";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config";

/** Constant-time check of a presented PIN against the configured APP_PIN. */
export function verifyPin(pin: unknown): boolean {
  if (typeof pin !== "string") return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(config.appPin);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
