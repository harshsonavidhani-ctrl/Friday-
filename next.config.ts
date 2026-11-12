import type { NextConfig } from "next";

// Cache Components is intentionally OFF: every page here depends on who is
// logged in (prices are only for approved retailers), so pages are rendered
// fresh on each request instead of being prerendered.
const nextConfig: NextConfig = {
  // PGlite (local dev database) ships WASM files, sharp ships native binaries
  // and exceljs uses Node streams, so they are loaded from node_modules.
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "exceljs"],
  // lets phones on the same Wi-Fi open the test site (npm run dev:phone)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  poweredByHeader: false,
  // the dev-only "N" badge sat on top of the language / bell buttons on phones
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera only for the IMEI scanner on this site; nothing else
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  async rewrites() {
    // Play Store app (Trusted Web Activity) proves it belongs to this website
    return [
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
      // browsers still ask for /favicon.ico — give them the app icon
      { source: "/favicon.ico", destination: "/icons/icon-192.png" },
    ];
  },
};

export default nextConfig;
