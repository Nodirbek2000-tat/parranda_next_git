import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets test builds go to a separate folder (e.g. .next-agent)
  // so they never overwrite the build a running `next start` is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Docker: Next faqat kerakli fayllarni `.next/standalone` ga yig'adi (Dockerfile NEXT_OUTPUT=standalone beradi).
  // Local `next start` uchun o'chiq qoladi.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    agentFeedback: true,
    // Uploads up to 10 MB (+ multipart overhead) must pass the /api proxy unchanged
    // (API_CONTRACT_V3 §4.5; node_modules/next/dist/docs/.../proxyClientMaxBodySize.md, default 10MB).
    proxyClientMaxBodySize: "11mb",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Only Telegram Web (web.telegram.org) may embed the app in a frame. The login page
  // treats a framed page as "inside Telegram" (lib/telegram.ts), so no other site may frame it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org" }],
      },
    ];
  },
  // The browser and the Telegram Web App only call relative /api/... paths;
  // Next.js proxies them to Django (same origin: no CORS, one tunnel to :3000).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
