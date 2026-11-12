import type { MetadataRoute } from "next";

// Google may list the shop and product pages (no prices are shown to guests);
// admin, accounts, orders and login links stay private.
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/orders", "/cart", "/notifications", "/l/"] }],
    ...(site ? { sitemap: `${site}/sitemap.xml`, host: site } : {}),
  };
}
