import Link from "next/link";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [s, t] = await Promise.all([getSettings(), getT()]);
  return (
    <div className="flex min-h-dvh flex-col bg-brand-950">
      <div className="pointer-events-none fixed -top-40 -right-40 size-96 rounded-full bg-gold-400/15 blur-3xl" />
      <header className="relative mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pt-8 pb-6">
        <Link href="/">
          <Logo name={s.shopName} tagline={t(s.tagline)} light />
        </Link>
        <LangSwitch dark />
      </header>
      <main className="relative mx-auto w-full max-w-md flex-1 px-4 pb-10">{children}</main>
    </div>
  );
}
