import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { LangProvider } from "@/components/LangProvider";
import { Splash, SPLASH_SCRIPT } from "@/components/Splash";
import { makeT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Hindi letters (Jakarta has no Devanagari, the browser falls back to this per letter)
const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: "Laxmi Associates — Wholesale Electronics",
    template: "%s · Laxmi Associates",
  },
  description:
    "Wholesale mobiles, TVs, ovens and electronics for retailers. Daily updated rates from Laxmi Associates (Mama).",
  applicationName: "Laxmi Associates",
  appleWebApp: { capable: true, title: "Laxmi Associates", statusBarStyle: "default" },
  icons: { apple: "/icons/icon-192.png" },
  openGraph: {
    type: "website",
    siteName: "Laxmi Associates",
    title: "Laxmi Associates — Wholesale Electronics",
    description: "Daily wholesale rates for retailers. Order online, pay by UPI.",
    locale: "en_IN",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#121a4b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Prices, stock and orders change all day and depend on who is logged in.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, s] = await Promise.all([getLang(), getSettings()]);
  const t = makeT(lang);
  return (
    // the splash script adds a class to <html> before React starts, so that one mismatch is expected
    <html lang={lang === "hi" ? "hi" : "en-IN"} className={`${jakarta.variable} ${deva.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        {/* splash first, then its script: it runs before the page below is even read, so nothing flashes */}
        <Splash name={s.shopName} tagline={t(s.tagline)} />
        <InlineScript html={SPLASH_SCRIPT} />
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
