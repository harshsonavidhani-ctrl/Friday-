"use client";

import {
  Bell,
  ClipboardList,
  FileSpreadsheet,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  Share2,
  Store,
  Tags,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAdmin } from "@/app/actions/auth";
import { useT } from "@/components/LangProvider";
import { LangSwitch } from "@/components/LangSwitch";

type Counts = { pendingOrders: number; toVerify: number; newRetailers: number; unread: number };
type Item = { href: string; label: string; icon: LucideIcon; badge?: number; exact?: boolean; strong?: boolean };

function items(c: Counts, t: (s: string) => string): Item[] {
  return [
    { href: "/admin", label: t("Dashboard"), icon: LayoutDashboard, exact: true },
    { href: "/admin#rates", label: t("Update Rates"), icon: TrendingUp, strong: true },
    { href: "/admin/products/new", label: t("Add new model"), icon: Plus, exact: true },
    { href: "/admin/prices", label: t("Prices & stock"), icon: IndianRupee, exact: true },
    { href: "/admin/orders", label: t("Orders"), icon: ClipboardList, badge: c.pendingOrders + c.toVerify },
    { href: "/admin/products", label: t("All products"), icon: Package },
    { href: "/admin/retailers", label: t("Retailers & khata"), icon: Users, badge: c.newRetailers },
    { href: "/admin/prices/import", label: t("Excel / Tally import"), icon: FileSpreadsheet },
    { href: "/admin/rate-list", label: t("Share rate list"), icon: Share2 },
    { href: "/admin/notifications", label: t("Alerts"), icon: Bell, badge: c.unread },
    { href: "/admin/categories", label: t("Categories"), icon: Tags },
    { href: "/admin/settings", label: t("Settings"), icon: Settings },
    { href: "/", label: t("View shop"), icon: Store, exact: true },
  ];
}

function isActive(path: string, it: Item) {
  if (it.exact) return path === it.href;
  if (it.href === "/admin/products") return path.startsWith("/admin/products") && path !== "/admin/products/new";
  return path.startsWith(it.href);
}

export function AdminSidebar({ counts }: { counts: Counts }) {
  const t = useT();
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {items(counts, t).map((it) => (
        <NavLink key={it.href} it={it} active={isActive(path, it)} />
      ))}
      <LogoutItem label={t("Logout")} />
      <div className="px-3 pt-4">
        <LangSwitch dark />
      </div>
    </nav>
  );
}

function NavLink({ it, active, onClick }: { it: Item; active: boolean; onClick?: () => void }) {
  const Icon = it.icon;
  return (
    <Link
      href={it.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
      } ${it.href === "/admin/products/new" && !active ? "text-gold-300" : ""} ${it.strong ? (active ? "bg-gold-400 text-brand-950" : "bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/40") : ""}`}
    >
      <Icon className="size-5" />
      <span className="flex-1">{it.label}</span>
      {!!it.badge && <span className="num rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold text-brand-950">{it.badge}</span>}
    </Link>
  );
}

function LogoutItem({ label }: { label: string }) {
  return (
    <form action={logoutAdmin}>
      <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white">
        <LogOut className="size-5" />
        <span className="flex-1 text-left">{label}</span>
      </button>
    </form>
  );
}

export function AdminMobileNav({ counts }: { counts: Counts }) {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const all = items(counts, t);
  const bottom = [all[0], all[1], all[2], all[4]];
  const moreBadge = counts.newRetailers;

  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {bottom.map((it) => {
            const Icon = it.icon;
            const active = isActive(path, it);
            const isAdd = it.href === "/admin/products/new";
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-brand-800" : "text-slate-500"}`}
              >
                {isAdd ? (
                  <span className="-mt-5 flex size-11 items-center justify-center rounded-2xl bg-gold-400 text-brand-950 shadow-lg ring-4 ring-white">
                    <Plus className="size-6" strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                )}
                {isAdd ? t("Add model") : it.href === "/admin#rates" ? t("Rates") : it.label}
                {!!it.badge && (
                  <span className="num absolute top-1 left-1/2 ml-2 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{it.badge}</span>
                )}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-slate-500"
          >
            <Menu className="size-[22px]" strokeWidth={1.75} />
            {t("More")}
            {!!moreBadge && (
              <span className="num absolute top-1 left-1/2 ml-2 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{moreBadge}</span>
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} aria-label={t("Close menu")} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] space-y-1 overflow-y-auto rounded-t-3xl bg-brand-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-bold text-white">{t("Menu")}</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/70" aria-label={t("Close")}>
                <X className="size-5" />
              </button>
            </div>
            {all.map((it) => (
              <NavLink key={it.href} it={it} active={isActive(path, it)} onClick={() => setOpen(false)} />
            ))}
            <LogoutItem label={t("Logout")} />
          </div>
        </div>
      )}
    </>
  );
}
