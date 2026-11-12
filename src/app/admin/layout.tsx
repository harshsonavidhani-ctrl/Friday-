import type { Metadata, Viewport } from "next";

// Mama's own app: installs separately from the retailers' app (its own name,
// gold icon and start page) but uses the same products, rates and orders.
export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  applicationName: "Mama — Laxmi Associates",
  appleWebApp: { capable: true, title: "Mama Admin", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/admin-192.png", icon: "/icons/admin-192.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#121a4b" };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
