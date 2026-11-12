import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { LangSwitch } from "@/components/LangSwitch";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";
import { shopLoginHref } from "@/lib/sites";

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
          {/* Mama's own icon (gold MAMA + crown) — the same one his phone shows */}
          <Image
            src="/icons/admin-192.png"
            alt="Mama"
            width={96}
            height={96}
            priority
            className="mx-auto size-24 rounded-[24px] shadow-xl shadow-gold-500/30"
          />
        </div>
        <div className="space-y-3 text-center text-white">
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
          {/* online the shops' app is on another address */}
          <a href={shopLoginHref()} className="font-semibold text-gold-300 underline">
            {t("open the retailers' app")}
          </a>
        </p>
      </main>
    </div>
  );
}
