import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Docker builds with NEXT_OUTPUT=standalone; local `next start` keeps the default output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Test builds may use another folder (NEXT_DIST_DIR=.next-agent) so a running build is not overwritten.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Only Telegram Web may frame the app.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org" }],
      },
    ];
  },
  // The browser only calls relative /api/... paths. In production nginx sends /api to Django directly;
  // this rewrite is the fallback (local dev, or the container without nginx).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
