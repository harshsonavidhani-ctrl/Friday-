import { Crown, Smartphone, Store, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Old app", robots: { index: false, follow: false } };

/**
 * Shown by the OLD Mama app that was installed from the shops' address before the
 * two apps were split. Instead of quietly opening Mama's panel inside the shops'
 * address (which looked like the two apps were mixed up), it says what to do.
 */
export default async function OldAppPage() {
  const t = await getT();
  const shop = process.env.SHOP_SITE_URL || "";
  const mama = process.env.ADMIN_SITE_URL || "";
  return (
    <div className="card space-y-5 p-6 sm:p-8">
      <div className="space-y-2 text-center">
        <Trash2 className="mx-auto size-12 text-rose-500" />
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("This is an old app — please delete it")}</h1>
        <p className="text-base text-slate-600">{t("Laxmi Associates now has two separate apps. Delete this one and install the right app:")}</p>
      </div>

      <a href={`${shop}/`} className="flex items-center gap-3 rounded-2xl bg-brand-900 p-4 text-white shadow-lg">
        <Store className="size-8 shrink-0 text-gold-300" />
        <span>
          <b className="block text-lg">{t("Shops: Laxmi Associates app")}</b>
          <span className="text-sm text-white/75">{t("Rates, cart, checkout and payment")}</span>
        </span>
      </a>
      <a href={`${mama}/admin`} className="flex items-center gap-3 rounded-2xl bg-gold-400 p-4 text-brand-950 shadow-lg">
        <Crown className="size-8 shrink-0" />
        <span>
          <b className="block text-lg">{t("Mama: Mama's app")}</b>
          <span className="text-sm text-brand-900/80">{t("Update rates, models, orders and retailers")}</span>
        </span>
      </a>

      <div className="space-y-1 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
        <p className="flex items-center gap-2 font-bold text-slate-800">
          <Smartphone className="size-4" /> {t("How to delete this old app")}
        </p>
        <p>{t("Press and hold its icon on the home screen → tap Uninstall (or App info → Uninstall). Then open the right link above in Chrome and tap Install app.")}</p>
      </div>
    </div>
  );
}
