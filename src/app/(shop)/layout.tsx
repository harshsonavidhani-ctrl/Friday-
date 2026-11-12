import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Header } from "@/components/shop/Header";
import { MobileNav } from "@/components/shop/MobileNav";
import { canSeePrices, getCurrentUser } from "@/lib/auth";
import { getCartCount } from "@/lib/cart";
import { telLink, waLink } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getUnreadCount } from "@/lib/notify";
import { getSettings, publicShopInfo } from "@/lib/settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, t] = await Promise.all([getCurrentUser(), getSettings(), getT()]);
  const shop = publicShopInfo(settings);
  const approved = canSeePrices(user);
  const [cartCount, unread] = await Promise.all([
    user && approved ? getCartCount(user.id) : 0,
    user ? getUnreadCount(user.id) : 0,
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        shopName={shop.shopName}
        tagline={shop.tagline}
        cartCount={cartCount}
        unread={unread}
        user={user ? { name: user.name, role: user.role } : null}
      />

      {user && !approved && (
        <div className="no-print border-b border-gold-200 bg-gold-50">
          <div className="mx-auto flex max-w-6xl items-start gap-2.5 px-4 py-2.5 text-sm text-gold-900">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <p>
              <b>{t("Your shop is waiting for approval.")}</b>{" "}
              {t("{name} will approve it soon — then you can see wholesale rates and order.", { name: shop.ownerName })}
              {shop.phone && (
                <>
                  {" "}
                  {t("Call")}{" "}
                  <a href={telLink(shop.phone)} className="font-semibold underline">
                    {shop.phone}
                  </a>{" "}
                  {t("to get approved faster.")}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pb-12">{children}</main>

      <footer className="no-print border-t border-slate-200 bg-white pb-20 md:pb-0">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <Logo name={shop.shopName} tagline={t(shop.tagline)} />
            <p className="mt-3 text-slate-500">{t("Wholesale mobiles & electronics. Rates are shown only to registered retailers.")}</p>
          </div>
          <div className="space-y-2">
            {shop.address && (
              <p className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {shop.address}
                {shop.city ? `, ${shop.city}` : ""}
              </p>
            )}
            {shop.phone && (
              <a href={telLink(shop.phone)} className="flex gap-2 hover:text-brand-800">
                <Phone className="mt-0.5 size-4 shrink-0 text-slate-400" /> {shop.phone}
              </a>
            )}
            {shop.whatsapp && (
              <a
                href={waLink(shop.whatsapp, `Hello ${shop.ownerName}, `)}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2 hover:text-brand-800"
              >
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-slate-400" /> {t("WhatsApp us")}
              </a>
            )}
          </div>
          <div className="text-slate-500 sm:text-right">
            {shop.gstin && <p>GSTIN: {shop.gstin}</p>}
            <p className="mt-1">
              © {new Date().getFullYear()} {shop.shopName}
            </p>
          </div>
        </div>
      </footer>

      <MobileNav cartCount={cartCount} />
    </div>
  );
}
