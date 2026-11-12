import type { NextConfig } from "next";
import { DEFAULT_ADMIN_URL, DEFAULT_SHOP_URL } from "./src/lib/sites";

// Which of the two online sites is this build? (see src/lib/sites.ts)
// Netlify gives every build its own address in URL; APP_ROLE overrides it.
const trim = (u?: string) => (u ?? "").trim().replace(/\/$/, "");
const hostOf = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};
const shopUrl = trim(process.env.SHOP_SITE_URL) || DEFAULT_SHOP_URL;
const adminUrl = trim(process.env.ADMIN_SITE_URL) || DEFAULT_ADMIN_URL;
const here = hostOf(trim(process.env.URL));
const role =
  process.env.APP_ROLE === "admin" || process.env.APP_ROLE === "shop"
    ? process.env.APP_ROLE
    : here && here === hostOf(adminUrl)
      ? "admin"
      : here && here === hostOf(shopUrl)
        ? "shop"
        : "";

// Cache Components is intentionally OFF: every page here depends on who is
// logged in (prices are only for approved retailers), so pages are rendered
// fresh on each request instead of being prerendered.
const nextConfig: NextConfig = {
  // lets the laptop test both sites side by side (separate build folders)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: {
    APP_ROLE: role,
    SHOP_SITE_URL: role ? shopUrl : "",
    ADMIN_SITE_URL: role ? adminUrl : "",
  },
  async redirects() {
    if (role === "admin") {
      // Mama's site opens straight on Mama's app
      return [
        { source: "/", destination: "/admin", permanent: false },
        { source: "/login", destination: "/admin/login", permanent: false },
        { source: "/register", destination: "/admin/login", permanent: false },
        { source: "/forgot", destination: "/admin/login", permanent: false },
      ];
    }
    if (role === "shop") {
      // the shops' site never shows Mama's pages — they live on Mama's own address
      return [
        { source: "/admin", destination: `${adminUrl}/admin`, permanent: false },
        { source: "/admin/:path*", destination: `${adminUrl}/admin/:path*`, permanent: false },
      ];
    }
    return [];
  },
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
