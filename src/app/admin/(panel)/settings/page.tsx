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

export default async function SettingsPage() {
  const [s, me, t, keys] = await Promise.all([getSettings(), getCurrentUser(), getT(), getVapidKeys()]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Settings")}</h1>
        <p className="num text-sm text-slate-500">
          {t("Admin login")}: {me?.phone}
        </p>
      </div>

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
