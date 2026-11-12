import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { LangSwitch } from "@/components/LangSwitch";
import { LogoMark } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Mama login" };

/** Mama's own login — only the admin can enter here. */
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const me = await getCurrentUser();
  if (me?.role === "admin") redirect("/admin");
  const [{ next }, s, t] = await Promise.all([searchParams, getSettings(), getT()]);
  return (
    <div className="flex min-h-dvh flex-col bg-brand-950">
      <div className="pointer-events-none fixed -top-40 -left-40 size-96 rounded-full bg-gold-400/25 blur-3xl" />
      <header className="relative mx-auto flex w-full max-w-md items-center justify-end px-4 pt-6">
        <LangSwitch dark />
      </header>
      <main className="relative mx-auto w-full max-w-md flex-1 space-y-6 px-4 pt-6 pb-10">
        <div className="space-y-3 text-center text-white">
          <div className="mx-auto w-fit rounded-[26px] bg-gold-400 p-1.5 shadow-xl shadow-gold-500/30">
            <LogoMark className="size-20 rounded-[22px]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">{t("{name}'s App", { name: s.ownerName })}</h1>
          <p className="text-base font-semibold text-gold-300">{s.shopName}</p>
        </div>
        <div className="card space-y-5 p-6">
          <p className="flex items-center gap-2 text-base font-bold text-brand-950">
            <ShieldCheck className="size-5 text-emerald-600" /> {t("Admin login — only for {name}", { name: s.ownerName })}
          </p>
          <LoginForm next={typeof next === "string" ? next : "/admin"} mode="admin" />
        </div>
        <p className="text-center text-sm text-white/70">
          {t("Shop owners:")}{" "}
          <Link href="/login" className="font-semibold text-gold-300 underline">
            {t("open the retailers' app")}
          </Link>
        </p>
      </main>
    </div>
  );
}
