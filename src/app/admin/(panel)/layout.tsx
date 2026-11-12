import type { Metadata } from "next";
import Link from "next/link";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminNav";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { BellLink } from "@/components/Notifications";
import { getAdminCounts } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getUnreadCount } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const [counts, unread, s, t] = await Promise.all([getAdminCounts(), getUnreadCount(me.id), getSettings(), getT()]);
  const c = { ...counts, unread };
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto bg-brand-950 p-4 lg:flex">
        <Link href="/admin" className="px-2 pt-2">
          <Logo name={s.shopName} tagline={t("Admin panel")} light />
        </Link>
        <AdminSidebar counts={c} />
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 bg-brand-950 px-4 py-3 lg:hidden">
          <Link href="/admin" className="min-w-0">
            <Logo name={s.shopName} tagline={t("Admin panel")} light />
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <LangSwitch dark compact />
            <BellLink href="/admin/notifications" count={unread} className="text-white/90" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>

      <AdminMobileNav counts={c} />
    </div>
  );
}
