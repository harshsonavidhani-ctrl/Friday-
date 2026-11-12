import { CircleX, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkLoginForm } from "@/components/AuthForms";
import { peekLoginToken } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Login link", robots: { index: false, follow: false } };

/**
 * One-tap login link from WhatsApp. Opening the page does NOT log in (WhatsApp
 * opens links to make previews) — the person taps the button.
 */
export default async function LinkLoginPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [info, s, t] = await Promise.all([peekLoginToken(token), getSettings(), getT()]);

  if (!info?.valid) {
    return (
      <div className="card space-y-4 p-6 text-center sm:p-8">
        <CircleX className="mx-auto size-12 text-rose-500" />
        <h1 className="text-xl font-extrabold text-brand-950">{t("This link has expired")}</h1>
        <p className="text-sm text-slate-600">
          {info?.usedAt ? t("It was already used once.") : t("Login links work for 7 days and only once.")}{" "}
          {t("Ask {name} for a new link, or login with your password.", { name: s.ownerName })}
        </p>
        <Link href="/login" className="btn btn-primary w-full">
          {t("Go to login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="card space-y-5 p-6 sm:p-8">
      <div className="space-y-2 text-center">
        <ShieldCheck className="mx-auto size-12 text-emerald-600" />
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">
          {t("Namaste {name}!", { name: info.name.split(" ")[0] })}
        </h1>
        <p className="text-sm text-slate-600">
          {t("{owner} sent you a login link for {shop}. Tap below to login — no password needed.", {
            owner: s.ownerName,
            shop: info.shopName || s.shopName,
          })}
        </p>
      </div>
      <LinkLoginForm token={token} />
      <p className="text-center text-xs text-slate-400">{t("Do not share this link with anyone.")}</p>
    </div>
  );
}
