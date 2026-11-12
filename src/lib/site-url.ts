import { headers } from "next/headers";

/** Public website address, e.g. https://laxmiassociates.in (for WhatsApp links). */
export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  // online, links for shops always point to the shops' address — also when Mama makes them
  if (process.env.SHOP_SITE_URL) return process.env.SHOP_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
