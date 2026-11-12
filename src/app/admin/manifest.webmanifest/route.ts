/** Install file for MAMA's app (admin) — separate from the retailers' app. */
export function GET() {
  return Response.json(
    {
      id: "/admin",
      name: "Mama — Laxmi Associates",
      short_name: "Mama Admin",
      description: "Mama's admin app: update rates, orders, retailers and khata",
      lang: "en-IN",
      start_url: "/admin?source=app",
      scope: "/admin",
      display: "standalone",
      orientation: "portrait",
      background_color: "#121a4b",
      theme_color: "#121a4b",
      categories: ["business", "productivity"],
      icons: [
        { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      shortcuts: [
        { name: "Update Rates", url: "/admin/rates", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
        { name: "Orders", url: "/admin/orders", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
        { name: "Add new model", url: "/admin/products/new", icons: [{ src: "/icons/admin-192.png", sizes: "192x192" }] },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
