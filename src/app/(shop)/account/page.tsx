import { BadgeCheck, Bell, BookOpenText, ChevronRight, Clock, KeyRound, LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton, PasswordForm, ProfileForm } from "@/components/AccountForms";
import { InstallApp } from "@/components/InstallApp";
import { BalanceText } from "@/components/Khata";
import { LangSwitch } from "@/components/LangSwitch";
import { PushToggle } from "@/components/PushToggle";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getLedger } from "@/lib/khata";
import { getVapidKeys } from "@/lib/push";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string; link?: string }> }) {
  const me = await requireUser("/account");
  const { welcome, link } = await searchParams;
  const [s, t, keys] = await Promise.all([getSettings(), getT(), getVapidKeys()]);
  const approved = me.role === "admin" || me.status === "approved";
  const ledger = me.role === "retailer" ? await getLedger(me.id) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{me.shopName || me.name}</h1>
          <p className="num text-sm text-slate-500">{me.phone}</p>
        </div>
        {approved ? (
          <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
            <BadgeCheck className="size-3.5" /> {me.role === "admin" ? t("Admin") : t("Approved retailer")}
          </span>
        ) : (
          <span className="badge bg-gold-50 text-gold-800 ring-gold-200">
            <Clock className="size-3.5" /> {t("Waiting for approval")}
          </span>
        )}
      </div>

      {me.viaLink ? (
        <section className="card space-y-3 border-l-4 border-emerald-500 p-5">
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

      {welcome && !approved && (
        <div className="card bg-gold-50 p-5 ring-gold-200">
          <p className="font-bold text-gold-900">{t("Thank you for registering!")}</p>
          <p className="mt-1 text-sm text-gold-900">
            {t("{name} will check and approve your shop. Once approved, wholesale rates and ordering unlock automatically — just open the website again.", {
              name: s.ownerName,
            })}
          </p>
        </div>
      )}

      {me.role === "admin" && (
        <Link href="/admin" className="btn btn-gold w-full sm:w-auto">
          <LayoutDashboard className="size-4" /> {t("Open admin panel")}
        </Link>
      )}

      {ledger && approved && (
        <Link href="/account/khata" className="card flex items-center gap-3 p-4 hover:ring-brand-300">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
            <BookOpenText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-brand-950">{t("My khata")}</p>
            <p className="num text-sm">
              <BalanceText amount={ledger.balance} />
            </p>
          </div>
          <ChevronRight className="size-5 text-slate-400" />
        </Link>
      )}

      <InstallApp />

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold text-brand-950">
          <Bell className="size-4" /> {t("Alerts & language")}
        </h2>
        <p className="text-sm text-slate-600">{t("Get a ping when your order is confirmed, dispatched or your payment is received.")}</p>
        <PushToggle publicKey={keys.publicKey} />
        <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
          <span className="text-sm font-medium text-slate-700">{t("Language")}</span>
          <LangSwitch />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-brand-950">{t("Shop details")}</h2>
        <ProfileForm me={{ name: me.name, shopName: me.shopName, gstin: me.gstin, city: me.city, address: me.address }} />
      </section>

      {!me.viaLink && (
        <section className="card space-y-4 p-5">
          <h2 className="font-bold text-brand-950">{t("Password")}</h2>
          <PasswordForm />
        </section>
      )}

      <LogoutButton />
    </div>
  );
}
