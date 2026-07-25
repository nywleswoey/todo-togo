// Mirrors POSTHOG_DISTINCT_ID in posthog-server.ts. It is redefined rather than
// imported because that module pulls in posthog-node, which cannot be bundled
// for the Edge runtime this file runs in.
const POSTHOG_DISTINCT_ID = "togo_user";

// A slow or unreachable PostHog must not hold the error path open indefinitely.
const CAPTURE_TIMEOUT_MS = 2_000;

/**
 * Report an exception to PostHog from the Edge runtime.
 *
 * `captureServerException` (src/lib/posthog-server.ts) is the Node path; it
 * relies on posthog-node, which does not run on Edge. Middleware is the one
 * piece of server code on Edge, so it posts a PostHog error-tracking
 * `$exception` event directly with `fetch` instead.
 *
 * Best-effort by contract: a missing token or a failing PostHog never turns
 * into a second error. The `$exception_list` shape is what PostHog's error
 * tracking UI reads — a bare message property would ingest but never surface as
 * an exception.
 */
export async function captureEdgeException(
  error: unknown,
  properties?: Record<string, unknown>,
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " +
          "this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return;
  }

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  const err = error instanceof Error ? error : new Error(String(error));

  try {
    const res = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
      body: JSON.stringify({
        api_key: token,
        event: "$exception",
        distinct_id: POSTHOG_DISTINCT_ID,
        properties: {
          ...properties,
          $exception_list: [
            {
              type: err.name,
              value: err.message,
              // Escaped middleware uncaught — not a handled outcome.
              mechanism: { handled: false, synthetic: false },
            },
          ],
          $exception_stack_trace_raw: err.stack,
        },
      }),
    });

    if (!res.ok && process.env.NODE_ENV === "development") {
      console.error(
        `PostHog rejected the Edge $exception capture with HTTP ${res.status}, ` +
          "this causes events to be silently missed.",
      );
    }
  } catch (captureError) {
    // Reporting an error must never raise a second one.
    if (process.env.NODE_ENV === "development") {
      console.error("PostHog Edge $exception capture failed", captureError);
    }
  }
}
