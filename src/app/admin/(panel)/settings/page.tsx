import { BadgeCheck, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { PasswordForm } from "@/components/AccountForms";
import { DemoCleanup, SettingsForm } from "@/components/admin/SettingsForm";
import { LangSwitch } from "@/components/LangSwitch";
import { PushToggle } from "@/components/PushToggle";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getVapidKeys } from "@/lib/push";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

const mask = (k: string) => (k ? `••••${k.slice(-4)}` : "");

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const [s, me, t, keys, { link }] = await Promise.all([getSettings(), getCurrentUser(), getT(), getVapidKeys(), searchParams]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Settings")}</h1>
        <p className="num text-sm text-slate-500">
          {t("Admin login")}: {me?.phone}
        </p>
      </div>

      {/* opened from a one-time login link → set a new password right here (no old one needed) */}
      {me?.viaLink ? (
        <section id="password" className="card space-y-3 border-l-4 border-emerald-500 p-5">
          <h2 className="flex items-center gap-2 font-bold text-brand-950">
            <KeyRound className="size-4 text-emerald-600" />
            {link ? t("You are logged in! Set a password (optional)") : t("Set a new password")}
          </h2>
          <p className="text-sm text-slate-600">{t("Then you can also login with your mobile number and password next time.")}</p>
          <PasswordForm noCurrent />
        </section>
      ) : (
        link && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
            <BadgeCheck className="size-5" /> {t("Password saved. Next time login with your mobile number and this password.")}
          </p>
        )
      )}

      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="font-bold text-brand-950">{t("This phone")}</h2>
        <PushToggle publicKey={keys.publicKey} />
        <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
          <span className="text-sm font-medium text-slate-700">{t("Language")}</span>
          <LangSwitch />
        </div>
      </section>

      <SettingsForm
        s={{ ...s, braveApiKey: mask(s.braveApiKey), serperApiKey: mask(s.serperApiKey) }}
        envKeys={{ brave: !!process.env.BRAVE_API_KEY, serper: !!process.env.SERPER_API_KEY }}
      />

      <section className="card space-y-4 p-4 sm:p-5">
        <h2 className="font-bold text-brand-950">{t("Change admin password")}</h2>
        <PasswordForm />
      </section>

      <section className="card space-y-2 p-4 sm:p-5">
        <h2 className="font-bold text-brand-950">{t("Before going live")}</h2>
        <p className="text-sm text-slate-600">
          {t("Removes the sample shop (8888888888) with its orders, the 8 sample products and the demo admin login (9999999999). Your own products, shops and orders stay.")}
        </p>
        <DemoCleanup />
      </section>
    </div>
  );
}
