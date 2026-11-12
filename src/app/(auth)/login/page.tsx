import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getT();
  return (
    <div className="card space-y-5 p-6 sm:p-8">
      <div>
        <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800 ring-1 ring-brand-200">
          <Store className="size-3.5" /> {t("Retailer login")}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Welcome back")}</h1>
        <p className="text-sm text-slate-500">{t("Login to see today's wholesale rates.")}</p>
      </div>
      <LoginForm next={typeof next === "string" ? next : ""} />
      <p className="text-center">
        <Link href="/forgot" className="text-sm font-semibold text-brand-700 hover:underline">
          {t("Forgot password?")}
        </Link>
      </p>
      <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
        {t("New retailer?")}{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          {t("Register your shop")}
        </Link>
      </p>
    </div>
  );
}
