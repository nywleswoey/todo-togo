import type { Instrumentation } from "next";

/**
 * Next.js server instrumentation.
 *
 * `onRequestError` is Next.js's hook for every uncaught error thrown while
 * rendering a route or Server Component — the server-side counterpart to the
 * browser's `capture_exceptions` (see `src/lib/posthog-client.ts`). It feeds
 * those errors into PostHog's error tracking. Handlers that catch their own
 * errors and answer with a response (e.g. the Gemini failure in
 * `POST /api/capture`) are handled operational outcomes and stay out of error
 * tracking by design; this only sees what escapes.
 *
 * The Edge runtime has no PostHog node client, so only report from Node. This
 * file is bundled for both runtimes (the PIN middleware runs on Edge), so the
 * node client is imported lazily — a static import would pull it into the Edge
 * bundle that the runtime check below never lets it run in.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { captureServerException } = await import("@/lib/posthog-server");

  await captureServerException(error, {
    path: request.path,
    method: request.method,
    router_kind: context.routerKind,
    // e.g. "render" | "action" — narrows where the error escaped.
    route_type: context.routeType,
  });
};
