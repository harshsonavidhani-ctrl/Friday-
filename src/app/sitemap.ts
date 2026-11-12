import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/catalog";

// built on each request (never at build time — the database may not be reachable then)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const items = await listProducts({ limit: 5000 });
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/register`, changeFrequency: "monthly", priority: 0.5 },
    ...items.map((p) => ({ url: `${site}/p/${p.id}`, lastModified: p.createdAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
