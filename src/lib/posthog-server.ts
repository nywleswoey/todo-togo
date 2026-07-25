import { after } from "next/server";
import { PostHog } from "posthog-node";

const POSTHOG_DISTINCT_ID = "togo_user";

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
