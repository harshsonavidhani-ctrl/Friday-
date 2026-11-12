import { ClipboardList, LayoutDashboard, Search, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { BellLink } from "@/components/Notifications";
import { getT } from "@/lib/i18n-server";

export async function Header({
  shopName,
  tagline,
  cartCount,
  unread,
  user,
}: {
  shopName: string;
  tagline: string;
  cartCount: number;
  unread: number;
  user: { name: string; role: string } | null;
}) {
  const t = await getT();
  return (
    <header className="no-print sticky top-0 z-30 bg-brand-950 text-white shadow-lg shadow-brand-950/10">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="min-w-0 shrink">
          <Logo name={shopName} tagline={t(tagline)} light />
        </Link>

        <SearchForm className="hidden flex-1 md:flex" placeholder={t("Search models, e.g. S24 Ultra, 43 inch TV…")} />

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {user?.role === "admin" && (
            <Link href="/admin" className="btn btn-gold btn-sm">
              <LayoutDashboard className="size-4" /> {t("Admin")}
            </Link>
          )}
          <Link href="/products" className="btn btn-sm text-white/90 hover:bg-white/10">
            {t("Products")}
          </Link>
          {user && (
            <Link href="/orders" className="btn btn-sm text-white/90 hover:bg-white/10">
              <ClipboardList className="size-4" /> {t("Orders")}
            </Link>
          )}
          <Link href="/cart" className="btn btn-sm relative text-white/90 hover:bg-white/10">
            <ShoppingCart className="size-4" /> {t("Cart")}
            {cartCount > 0 && (
              <span className="num rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-brand-950">{cartCount}</span>
            )}
          </Link>
          {user && <BellLink href={user.role === "admin" ? "/admin/notifications" : "/notifications"} count={unread} className="text-white/90 hover:bg-white/10" />}
          {user ? (
            <Link href="/account" className="btn btn-sm text-white/90 hover:bg-white/10">
              <User className="size-4" /> {user.name.split(" ")[0]}
            </Link>
          ) : (
            <Link href="/login" className="btn btn-gold btn-sm">
              {t("Login")}
            </Link>
          )}
          <LangSwitch dark compact className="ml-1" />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:hidden">
          <LangSwitch dark compact />
          {user && <BellLink href={user.role === "admin" ? "/admin/notifications" : "/notifications"} count={unread} className="text-white/90" />}
          {!user && (
            <Link href="/login" className="btn btn-gold btn-sm">
              {t("Login")}
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/admin" className="btn btn-gold btn-sm px-2.5" aria-label={t("Admin")}>
              <LayoutDashboard className="size-4" />
            </Link>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchForm className="flex" placeholder={t("Search models, e.g. S24 Ultra, 43 inch TV…")} />
      </div>
    </header>
  );
}

function SearchForm({ className = "", placeholder }: { className?: string; placeholder: string }) {
  return (
    <form action="/products" className={`relative max-w-xl ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
      <input
        name="q"
        type="search"
        placeholder={placeholder}
        className="w-full rounded-xl border-0 bg-white py-2.5 pr-3 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-gold-300/50 focus:outline-none sm:text-[15px]"
      />
    </form>
  );
}
