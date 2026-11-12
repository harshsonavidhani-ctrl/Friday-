import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/AuthForms";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPage() {
  const [s, t] = await Promise.all([getSettings(), getT()]);
  return (
    <div className="card space-y-5 p-6 sm:p-8">
      <div className="space-y-2">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-800">
          <KeyRound className="size-5" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Forgot password?")}</h1>
        <p className="text-sm text-slate-500">
          {t("No problem. {name} will send you a one-tap login link on WhatsApp — no password needed.", { name: s.ownerName })}
        </p>
      </div>
      <ForgotForm shopWhatsapp={s.whatsapp || s.phone} ownerName={s.ownerName} />
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {t("Back to login")}
        </Link>
      </p>
    </div>
  );
}
