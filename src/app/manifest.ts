import type { MetadataRoute } from "next";

// The RETAILERS' app (install file). Mama's admin app has its own:
// /admin/manifest.webmanifest — two apps, one shop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Laxmi Associates",
    short_name: "Laxmi Assoc.",
    description: "Wholesale electronics — daily rates & easy ordering for retailers",
    lang: "en-IN",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#121a4b",
    theme_color: "#121a4b",
    categories: ["shopping", "business"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today's rates", short_name: "Rates", url: "/products", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My orders", short_name: "Orders", url: "/orders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cart", url: "/cart", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
