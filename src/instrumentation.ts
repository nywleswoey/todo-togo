import type { Instrumentation } from "next";
import { captureServerException } from "@/lib/posthog-server";

/**
 * Next.js server instrumentation.
 *
 * `onRequestError` is Next.js's hook for every uncaught error thrown while
 * rendering a route or Server Component — the server-side counterpart to the
 * browser's `capture_exceptions` (see `src/app/providers.tsx`). It feeds those
 * errors into PostHog's error tracking. Handlers that catch their own errors
 * (e.g. the Gemini failure in `POST /api/capture`) report explicitly instead;
 * this only sees what escapes.
 *
 * The Edge runtime has no PostHog node client, so only report from Node.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  await captureServerException(error, {
    path: request.path,
    method: request.method,
    // e.g. "render" | "action" — narrows where the error escaped.
    router_kind: context.routerKind,
    route_type: context.routeType,
  });
};
