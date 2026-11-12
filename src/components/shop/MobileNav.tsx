"use client";

import { ClipboardList, House, LayoutGrid, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/LangProvider";

export function MobileNav({ cartCount }: { cartCount: number }) {
  const t = useT();
  const path = usePathname();
  const items = [
    { href: "/", label: t("Home"), icon: House, active: path === "/" },
    { href: "/products", label: t("Products"), icon: LayoutGrid, active: path.startsWith("/products") || path.startsWith("/p/") },
    { href: "/cart", label: t("Cart"), icon: ShoppingCart, active: path === "/cart", badge: cartCount },
    { href: "/orders", label: t("Orders"), icon: ClipboardList, active: path.startsWith("/orders") },
    { href: "/account", label: t("Account"), icon: User, active: path.startsWith("/account") || path === "/notifications" },
  ];
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[calc(env(safe-area-inset-bottom)+var(--badge,0px))] backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, active, badge }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-brand-800" : "text-slate-500"}`}
          >
            <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
            {label}
            {!!badge && (
              <span className="num absolute top-1 left-1/2 ml-2 rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-brand-950">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
