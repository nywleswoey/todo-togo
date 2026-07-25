import { after } from "next/server";
import { PostHog } from "posthog-node";

// Mirrored in src/lib/posthog-edge.ts, which cannot import from here without
// pulling posthog-node into the Edge bundle. Change both together.
const POSTHOG_DISTINCT_ID = "togo_user";

/**
 * How long a flush may hold up its caller. posthog-node defaults to 30s, which
 * an awaited flush would spend blocking the request that failed whenever
 * PostHog is unreachable.
 */
const FLUSH_TIMEOUT_MS = 2_000;

function createClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " +
          "this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return null;
  }
  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

/**
 * Record a server-side product event for the single Togo user.
 *
 * Best-effort by contract: the send is deferred until after the response has
 * been handed back, and a slow or failing PostHog can neither delay nor fail
 * the request that triggered it.
 *
 * Event names and properties are a dashboard contract — see
 * `docs/analytics-events.md` before renaming one.
 */
export function captureServerEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  const client = createClient();
  if (!client) return;

  const send = async () => {
    try {
      client.capture({ distinctId: POSTHOG_DISTINCT_ID, event, properties });
      await client.shutdown();
    } catch {
      // Analytics failures are never worth surfacing to the caller.
    }
  };

  try {
    after(send);
  } catch {
    void send();
  }
}

/**
 * Report a server-side exception to PostHog's error tracking for the single
 * Togo user.
 *
 * Awaitable, unlike {@link captureServerEvent}: the caller decides whether to
 * block. `onRequestError` (see `src/instrumentation.ts`) awaits it so the flush
 * lands before a serverless instance is frozen or reused; route `catch` blocks
 * can defer it with `after` instead. Either way it is best-effort — a failing
 * PostHog never turns into a thrown error.
 */
export async function captureServerException(
  error: unknown,
  properties?: Record<string, unknown>,
): Promise<void> {
  const client = createClient();
  if (!client) return;

  try {
    client.captureException(error, POSTHOG_DISTINCT_ID, properties);
    await client.shutdown(FLUSH_TIMEOUT_MS);
  } catch {
    // Reporting an error must never raise a second one.
  }
}
