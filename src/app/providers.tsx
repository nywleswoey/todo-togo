"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { initPostHogClient } from "@/lib/posthog-client";

/**
 * Browser-side PostHog setup. The client and its configuration live in
 * `src/lib/posthog-client.ts`, shared with the root error boundary.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHogClient();
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
