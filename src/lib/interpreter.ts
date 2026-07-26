import "server-only";
import { config } from "./config";
import type { PromptContext } from "./prompt";
import type { IntentResult } from "./intent";
import { geminiInterpreter } from "./interpreters/gemini";

/**
 * The audio→intent seam, as a swappable adapter. The capture route depends only
 * on this contract, never on a concrete provider — so once a second backend (a
 * different model, a different vendor, or a stub) is registered below, switching
 * to it is a `CAPTURE_PROVIDER` change rather than a route change. Gemini is the
 * only provider registered today.
 *
 * Tests mock this module; everything above it (the route, the apply logic) is
 * exercised without a live model.
 */

export interface InterpretInput {
  audioBase64: string;
  mimeType: string;
  ctx: PromptContext;
}

/** A backend that turns a spoken clip into a parsed IntentResult in one hop. */
export interface AudioInterpreter {
  interpret(input: InterpretInput): Promise<IntentResult>;
}

/**
 * Known providers, keyed by the CAPTURE_PROVIDER value that selects them. Add a
 * new backend by implementing AudioInterpreter and registering it here — nothing
 * else in the app needs to change.
 */
const REGISTRY: Record<string, AudioInterpreter> = {
  gemini: geminiInterpreter,
};

/** Resolve the configured backend, or fail loudly on an unknown provider. */
export function getInterpreter(): AudioInterpreter {
  const provider = config.captureProvider;
  const impl = REGISTRY[provider];
  if (!impl) {
    throw new Error(
      `Unknown CAPTURE_PROVIDER "${provider}" (known: ${Object.keys(REGISTRY).join(", ")})`,
    );
  }
  return impl;
}

/** Convenience entry point for the capture route — delegates to the selection. */
export function interpretAudio(input: InterpretInput): Promise<IntentResult> {
  return getInterpreter().interpret(input);
}
