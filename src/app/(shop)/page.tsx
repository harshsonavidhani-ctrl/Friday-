import { ArrowRight, BadgeCheck, Clock, ShieldCheck, Store, TrendingDown, Truck } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ProductCard, ProductGrid } from "@/components/shop/ProductCard";
import { RetailerDashboard } from "@/components/shop/RetailerDashboard";
import { canSeePrices, getCurrentUser } from "@/lib/auth";
import { getCategoriesWithCounts, getLastPriceUpdate, listProducts } from "@/lib/catalog";
import { relativeDay } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export default async function HomePage() {
  const [user, s, cats, latest, lastUpdate, t] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getCategoriesWithCounts(),
    listProducts({ limit: 8 }),
    getLastPriceUpdate(),
    getT(),
  ]);
  const showPrice = canSeePrices(user);
  // approved retailers land on their dashboard: today's rates, read-only, add to cart
  if (user && showPrice) return <RetailerDashboard user={user} />;
  const drops = showPrice ? await listProducts({ priceDropsOnly: true, limit: 8 }) : [];
  const iconOf = new Map(cats.map((c) => [c.id, c.icon]));
  const visibleCats = cats.filter((c) => c.count > 0);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-950 px-5 py-8 text-white sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative max-w-2xl">
          {lastUpdate && (
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-200 ring-1 ring-white/15">
              <Clock className="size-3.5" /> {t("Rates updated {when}", { when: relativeDay(lastUpdate) })}
            </p>
          )}
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            {t("Wholesale electronics at")} <span className="text-gold-400">{t("today's best rates")}</span>
          </h1>
          <p className="mt-3 text-base text-white/75 sm:text-lg">
            {t("Mobiles, TVs, ovens and more for retailers — direct from {shop}, trusted across the market as", { shop: s.shopName })}{" "}
            <b className="text-white">“{s.ownerName}”</b>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {!user ? (
              <>
                <Link href="/register" className="btn btn-gold btn-lg">
                  <Store className="size-5" /> {t("Register your shop")}
                </Link>
                <Link href="/login" className="btn btn-lg bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15">
                  {t("Login")}
                </Link>
              </>
            ) : (
              <>
                <Link href="/products" className="btn btn-gold btn-lg">
                  {t("Browse products")} <ArrowRight className="size-5" />
                </Link>
                <Link href="/orders" className="btn btn-lg bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15">
                  {t("My orders")}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      {visibleCats.length > 0 && (
        <section>
          <SectionTitle title={t("Shop by category")} href="/products" more={t("View all")} />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-6">
            {visibleCats.map((c) => (
              <Link
                key={c.id}
                href={`/products?cat=${c.id}`}
                className="card flex w-28 shrink-0 flex-col items-center gap-2 px-2 py-4 text-center transition hover:ring-brand-300 sm:w-auto"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
                  <CategoryIcon icon={c.icon} className="size-6" />
                </span>
                <span className="text-[13px] leading-tight font-semibold text-slate-800">{t(c.name)}</span>
                <span className="text-[11px] text-slate-500">{t(c.count === 1 ? "{n} model" : "{n} models", { n: c.count })}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Price drops */}
      {drops.length > 0 && (
        <section>
          <SectionTitle
            title={
              <span className="flex items-center gap-2">
                <TrendingDown className="size-5 text-emerald-600" /> {t("Price drops")}
              </span>
            }
          />
          <ProductGrid>
            {drops.map((p) => (
              <ProductCard key={p.id} p={p} showPrice={showPrice} icon={iconOf.get(p.categoryId ?? 0)} />
            ))}
          </ProductGrid>
        </section>
      )}

      {/* New arrivals */}
      <section>
        <SectionTitle title={t("New arrivals")} href="/products" more={t("View all")} />
        {latest.length ? (
          <ProductGrid>
            {latest.map((p) => (
              <ProductCard key={p.id} p={p} showPrice={showPrice} icon={iconOf.get(p.categoryId ?? 0)} />
            ))}
          </ProductGrid>
        ) : (
          <p className="card p-8 text-center text-slate-500">{t("Products will appear here soon.")}</p>
        )}
      </section>

      {/* How it works */}
      {!user && (
        <section className="card grid gap-6 p-6 sm:grid-cols-3 sm:p-8">
          {[
            { icon: Store, title: t("1. Register your shop"), text: t("Takes one minute — name, shop, mobile number.") },
            { icon: BadgeCheck, title: t("2. Get approved"), text: t("{name} approves retailers, then wholesale rates unlock.", { name: s.ownerName }) },
            { icon: Truck, title: t("3. Order & collect"), text: t("Pick up from the shop or get it sent by parcel.") },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-800">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-bold text-slate-900">{title}</p>
                <p className="text-sm text-slate-600">{text}</p>
              </div>
            </div>
          ))}
          <p className="flex items-center gap-2 text-xs text-slate-500 sm:col-span-3">
            <ShieldCheck className="size-4" /> {t("Wholesale prices are private — only approved retailers can see them.")}
          </p>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ title, href, more }: { title: React.ReactNode; href?: string; more?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-lg font-extrabold tracking-tight text-brand-950 sm:text-xl">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900">
          {more} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
