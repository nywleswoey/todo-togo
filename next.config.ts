import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes handle audio uploads and the Gemini SDK — force the Node runtime.
  serverExternalPackages: ["@google/genai", "@neondatabase/serverless"],
};

export default nextConfig;
