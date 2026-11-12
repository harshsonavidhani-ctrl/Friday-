import { ChevronRight, FileDown, Search, Store, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge, PayStateBadge } from "@/components/Badges";
import { PAY_PLAN_LABEL } from "@/lib/constants";
import { formatDate, formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { listOrders } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders" };

const TABS = [
  { key: "pending", label: "To confirm" },
  { key: "active", label: "In progress" },
  { key: "to_verify", label: "Payments to verify" },
  { key: "unpaid", label: "Unpaid / udhaar" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? (q ? "all" : "pending");
  const tab = TABS.find((x) => x.key === status) ?? TABS[0];
  const [all, t] = await Promise.all([listOrders({ limit: 500, q }), getT()]);

  const counts = Object.fromEntries(TABS.map((x) => [x.key, all.filter((r) => matches(x.key, r)).length])) as Record<string, number>;
  const rows = all.filter((r) => matches(tab.key, r));
  const qs = (k: string) => `/admin/orders?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Orders")}</h1>
        <a href="/api/admin/export/orders" className="btn btn-outline btn-sm">
          <FileDown className="size-4" /> {t("Download Excel")}
        </a>
      </div>
      <form className="relative" role="search">
        <input type="hidden" name="status" value={q ? tab.key : "all"} />
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("Search order no., shop, phone or IMEI")}
          className="input pl-10"
          aria-label={t("Search orders")}
        />
      </form>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((x) => (
          <Link key={x.key} href={qs(x.key)} className={`chip ${x.key === tab.key ? "chip-active" : ""}`}>
            {t(x.label)}
            {x.key !== "all" && counts[x.key] > 0 && (
              <span className={`num rounded-full px-1.5 text-[11px] font-bold ${x.key === tab.key ? "bg-white/20" : "bg-slate-100"}`}>{counts[x.key]}</span>
            )}
          </Link>
        ))}
      </div>

      <ul className="card divide-y divide-slate-100">
        {rows.map(({ order: o, shopName, customerName, itemCount, pay }) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                {o.deliveryMethod === "parcel" ? <Truck className="size-5" /> : <Store className="size-5" />}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-semibold text-slate-900">
                  {orderNo(o.id)} · {shopName || customerName}
                </p>
                <p className="num text-xs text-slate-500">
                  {formatDate(o.createdAt)} · {t("{n} pcs", { n: itemCount })} · {t(PAY_PLAN_LABEL[o.payPlan])}
                </p>
                <div className="flex flex-wrap gap-1">
                  <OrderStatusBadge status={o.status} />
                  {o.status !== "cancelled" && (o.status !== "pending" || pay.state !== "unpaid") && <PayStateBadge state={pay.state} />}
                </div>
              </div>
              <div className="text-right">
                <p className="num font-bold text-slate-900">{formatINR(o.total)}</p>
                {pay.balance > 0 && o.status !== "cancelled" && o.status !== "pending" && (
                  <p className="num text-xs font-semibold text-rose-600">{t("Due {amount}", { amount: formatINR(pay.balance) })}</p>
                )}
              </div>
              <ChevronRight className="size-5 text-slate-400" />
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-8 text-center text-sm text-slate-500">{q ? t("No orders match “{q}”.", { q }) : t("No orders here.")}</li>}
      </ul>
    </div>
  );
}

function matches(key: string, r: Awaited<ReturnType<typeof listOrders>>[number]) {
  const s = r.order.status;
  switch (key) {
    case "pending":
      return s === "pending";
    case "active":
      return s === "confirmed" || s === "dispatched" || s === "ready";
    case "to_verify":
      return r.pay.submitted > 0;
    case "unpaid":
      return s !== "cancelled" && s !== "pending" && r.pay.verified < r.order.total;
    case "completed":
      return s === "completed";
    case "cancelled":
      return s === "cancelled";
    default:
      return true;
  }
}
