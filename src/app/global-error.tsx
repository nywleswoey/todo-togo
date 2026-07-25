"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Root error boundary. Next.js renders this when an error escapes the root
 * layout — the one place `capture_exceptions` (see `src/app/providers.tsx`)
 * cannot reach, because the PostHog provider lives inside the layout that has
 * already unmounted. Report it explicitly, then show a minimal recovery screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Something went wrong</h1>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.6rem 1.25rem",
            borderRadius: "999px",
            border: "none",
            background: "#0f766e",
            color: "white",
            fontSize: "1rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
