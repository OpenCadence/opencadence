import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // Brand assets are served directly from public/. Disabling the unused image
  // optimizer keeps Sharp and its bundled libvips libraries out of releases.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // The container build opts into Next's minimal Node server; source installs
  // keep using the supported `next start` path.
  output: process.env.CADENCE_STANDALONE === "1" ? "standalone" : undefined,
};
export default config;
