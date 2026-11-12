import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  FileSpreadsheet,
  IndianRupee,
  Plus,
  Search,
  Share2,
  TrendingUp,
  TriangleExclamationPoint,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { RatesStudioLoader } from "@/components/admin/RatesStudioLoader";
import { OrderStatusBadge, PayStateBadge } from "@/components/Badges";
import { PushToggle } from "@/components/PushToggle";
import { getAdminCounts, getDashboardStats, getLowStock } from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { listOrders } from "@/lib/orders";
import { getVapidKeys } from "@/lib/push";
import { getRatesStudioData } from "@/lib/rates-data";
import { getSettings } from "@/lib/settings";

export default async function AdminHome() {
  const studio = await getRatesStudioData();
  const [me, counts, stats, low, recent, s, t, keys] = await Promise.all([
    getCurrentUser(),
    getAdminCounts(),
    getDashboardStats(),
    getLowStock(),
    listOrders({ limit: 6 }),
    getSettings(),
    getT(),
    getVapidKeys(),
  ]);

  const setup = [
    { done: !!(s.phone || s.whatsapp), label: "Add shop phone & WhatsApp number" },
    { done: !!s.upiId, label: "Add UPI ID (for payment QR)" },
    { done: !!(process.env.BRAVE_API_KEY || process.env.SERPER_API_KEY || s.braveApiKey || s.serperApiKey), label: "Turn on automatic photo search" },
    { done: !!s.address, label: "Add shop address" },
  ].filter((x) => !x.done);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Namaste, {name}", { name: me?.name ?? "Mama" })}</h1>
        <p className="text-sm text-slate-500">{t("Here is your shop today.")}</p>
      </div>

      {(counts.pendingOrders > 0 || counts.toVerify > 0 || counts.newRetailers > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {counts.pendingOrders > 0 && (
            <Alert href="/admin/orders?status=pending" tone="gold" icon={ClipboardList} text={t("{n} new order(s) to confirm", { n: counts.pendingOrders })} />
          )}
          {counts.toVerify > 0 && (
            <Alert href="/admin/orders?status=to_verify" tone="sky" icon={Wallet} text={t("{n} payment(s) to verify", { n: counts.toVerify })} />
          )}
          {counts.newRetailers > 0 && (
            <Alert href="/admin/retailers?tab=pending" tone="violet" icon={UserPlus} text={t("{n} shop(s) waiting for approval", { n: counts.newRetailers })} />
          )}
        </div>
      )}

      {/* one page: dashboard on top, scroll down for Update Rates */}
      <a
        href="#rates"
        className="group flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-gold-400 to-gold-500 p-5 text-brand-950 shadow-lg shadow-gold-500/25 active:scale-[0.99] sm:p-6"
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-950 text-gold-300 shadow-md">
          <TrendingUp className="size-8" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xl leading-tight font-black tracking-tight uppercase">{t("Update Rates")}</span>
          <span className="block text-sm font-bold text-brand-950/75">{t("Scroll down — it is on this page")}</span>
        </span>
        <ArrowDown className="size-8 shrink-0 animate-bounce" strokeWidth={3} />
      </a>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Quick href="/admin/products/new" icon={Plus} label={t("Add new model")} primary />
        <Quick href="/admin/prices" icon={IndianRupee} label={t("Update prices")} />
        <Quick href="/admin/prices/import" icon={FileSpreadsheet} label={t("Excel / Tally import")} />
        <Quick href="/admin/rate-list" icon={Share2} label={t("Share rate list")} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Today's orders")} value={String(stats.todayOrders)} />
        <Stat label={t("Today's sales")} value={formatINR(stats.todaySales)} />
        <Link href="/admin/retailers?tab=collect" className="contents">
          <Stat label={t("To collect (udhaar)")} value={formatINR(stats.outstanding)} tone="text-rose-700" link />
        </Link>
        <Stat
          label={t("Live products")}
          value={String(stats.products)}
          sub={stats.outOfStock ? t("{n} variant(s) out of stock", { n: stats.outOfStock }) : t("All in stock")}
        />
      </div>

      <form action="/admin/orders" className="relative" role="search">
        <input type="hidden" name="status" value="all" />
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
        <input name="q" type="search" placeholder={t("Find an order — order no., shop, phone or IMEI")} className="input bg-white pl-10" />
      </form>

      <section className="card space-y-2 p-4 sm:p-5">
        <h2 className="font-bold text-brand-950">{t("Order alerts on your phone")}</h2>
        <p className="text-sm text-slate-600">{t("Get a ping for every new order, payment and new shop — even when the app is closed.")}</p>
        <PushToggle publicKey={keys.publicKey} />
      </section>

      {setup.length > 0 && (
        <section className="card border-l-4 border-gold-400 p-5">
          <h2 className="font-bold text-brand-950">{t("Finish setting up")}</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {setup.map((x) => (
              <li key={x.label} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-gold-500" /> {t(x.label)}
              </li>
            ))}
          </ul>
          <Link href="/admin/settings" className="btn btn-gold btn-sm mt-3">
            {t("Open settings")}
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-bold text-brand-950">{t("Latest orders")}</h2>
            <Link href="/admin/orders" className="flex items-center gap-1 text-sm font-semibold text-brand-700">
              {t("All")} <ArrowRight className="size-4" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{t("No orders yet.")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map(({ order: o, shopName, pay }) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {orderNo(o.id)} · {shopName}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(o.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="num text-sm font-bold">{formatINR(o.total)}</span>
                      <div className="flex gap-1">
                        <OrderStatusBadge status={o.status} />
                        {o.status !== "cancelled" && (o.status !== "pending" || pay.state !== "unpaid") && <PayStateBadge state={pay.state} />}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="flex items-center gap-2 font-bold text-brand-950">
              <TriangleExclamationPoint className="size-4 text-gold-600" /> {t("Low stock")}
            </h2>
            <Link href="/admin/prices" className="text-sm font-semibold text-brand-700">
              {t("Update")}
            </Link>
          </div>
          {low.length === 0 ? (
            <p className="flex items-center gap-2 p-5 text-sm text-emerald-700">
              <BadgeCheck className="size-4" /> {t("Stock looks good")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {low.map((v) => (
                <li key={v.variantId} className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <Link href={`/admin/products/${v.productId}`} className="min-w-0 truncate hover:text-brand-800">
                    {v.name} {v.label && <span className="text-slate-500">{v.label}</span>}
                  </Link>
                  <span className={`num shrink-0 font-bold ${v.stock <= 0 ? "text-rose-600" : "text-gold-700"}`}>
                    {v.stock <= 0 ? t("Out") : t("{n} left", { n: v.stock })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section id="rates" className="scroll-mt-20 space-y-3 border-t-4 border-gold-400 pt-6">
        <h2 className="flex items-center gap-3 text-3xl font-black tracking-tight text-brand-950 uppercase">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gold-400 text-brand-950">
            <TrendingUp className="size-6" strokeWidth={2.5} />
          </span>
          {t("Update Rates")}
        </h2>
        <RatesStudioLoader {...studio} embedded />
      </section>
    </div>
  );
}

function Alert({ href, text, icon: Icon, tone }: { href: string; text: string; icon: typeof Plus; tone: "gold" | "sky" | "violet" }) {
  const tones = {
    gold: "bg-gold-50 text-gold-900 ring-gold-200",
    sky: "bg-sky-50 text-sky-900 ring-sky-200",
    violet: "bg-violet-50 text-violet-900 ring-violet-200",
  };
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold ring-1 ${tones[tone]}`}>
      <Icon className="size-5 shrink-0" />
      <span className="flex-1">{text}</span>
      <ArrowRight className="size-4" />
    </Link>
  );
}

function Quick({ href, icon: Icon, label, primary }: { href: string; icon: typeof Plus; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-start gap-3 rounded-2xl p-4 font-bold transition active:scale-[0.98] ${
        primary ? "bg-brand-900 text-white hover:bg-brand-950" : "card text-brand-950 hover:ring-brand-300"
      }`}
    >
      <span className={`flex size-10 items-center justify-center rounded-xl ${primary ? "bg-gold-400 text-brand-950" : "bg-brand-50 text-brand-800"}`}>
        <Icon className="size-5" />
      </span>
      <span className="text-sm">{label}</span>
    </Link>
  );
}

function Stat({ label, value, sub, tone = "text-brand-950", link }: { label: string; value: string; sub?: string; tone?: string; link?: boolean }) {
  return (
    <div className={`card p-4 ${link ? "hover:ring-brand-300" : ""}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`num mt-1 text-xl font-extrabold ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
