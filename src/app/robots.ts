import type { MetadataRoute } from "next";
import { appRole } from "@/lib/sites";

// Google may list the shop and product pages (no prices are shown to guests);
// admin, accounts, orders and login links stay private. Mama's own address is
// never listed at all.
export default function robots(): MetadataRoute.Robots {
  if (appRole() === "admin") return { rules: [{ userAgent: "*", disallow: "/" }] };
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SHOP_SITE_URL)?.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/orders", "/cart", "/notifications", "/l/"] }],
    ...(site ? { sitemap: `${site}/sitemap.xml`, host: site } : {}),
  };
}
