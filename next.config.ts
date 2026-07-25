import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes handle audio uploads and the Gemini SDK — force the Node runtime.
  serverExternalPackages: ["@google/genai", "@neondatabase/serverless"],
  // Reverse-proxy PostHog under our own origin so ad/tracker blockers don't
  // drop analytics. The client always talks to /ingest (see src/lib/posthog-client.ts);
  // the US region is fixed here, so NEXT_PUBLIC_POSTHOG_HOST only steers the
  // server-side client. PostHog's ingest paths are trailing-slash sensitive,
  // hence skipTrailingSlashRedirect below.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
