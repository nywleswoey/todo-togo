"use client";

import posthog from "posthog-js";

/**
 * Initialise the browser PostHog client, once per page load.
 *
 * Two entry points need it: the provider mounted by the root layout
 * (`src/app/providers.tsx`) and the root error boundary
 * (`src/app/global-error.tsx`), which replaces that layout and so is the only
 * one to run when the layout itself fails to render. Whichever gets there
 * first wins; the other no-ops.
 *
 * Analytics silently no-op without a project token, so a missing one is only
 * surfaced in development.
 *
 * `api_host: "/ingest"` routes capture through our own origin (rewrites in
 * `next.config.ts`) so tracker blockers don't drop it. The events this client
 * sends are catalogued in `docs/analytics-events.md`.
 */
export function initPostHogClient(): void {
  if (posthog.__loaded) return;

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

  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    tracing_headers: ["localhost"],
  });
}
