import type { MetadataRoute } from "next";
import { appRole } from "./sites";

/** The RETAILERS' app (navy "LA" icon). */
export function shopManifest(): MetadataRoute.Manifest {
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

/**
 * MAMA's own app (gold "MAMA" + crown icon). Online it lives on its own address
 * (laxmi-mama.netlify.app), so it covers that whole site; on the laptop both apps
 * share one address and it only covers /admin.
 */
export function adminManifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Mama — Laxmi Associates",
    short_name: "Mama",
    description: "Mama's own app: update rates, orders, retailers and khata",
    lang: "en-IN",
    start_url: "/admin?source=app",
    scope: appRole() === "admin" ? "/" : "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#121a4b",
    theme_color: "#121a4b",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Update Rates", url: "/admin#rates", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
      { name: "Orders", url: "/admin/orders", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
      { name: "Add new model", url: "/admin/products/new", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
    ],
  };
}
