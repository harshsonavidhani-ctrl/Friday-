import { ChevronRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge, PayStateBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { formatDate, formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { listOrders } from "@/lib/orders";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const [rows, t] = await Promise.all([listOrders({ userId: user.id }), getT()]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{t("My orders")}</h1>
      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <ClipboardList className="size-10 text-slate-300" />
          <p className="font-semibold text-slate-800">{t("No orders yet")}</p>
          <Link href="/products" className="btn btn-primary">
            {t("Start ordering")}
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {rows.map(({ order: o, itemCount, pay }) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{orderNo(o.id)}</span>
                    <OrderStatusBadge status={o.status} />
                    {o.status !== "cancelled" && (o.status !== "pending" || pay.state !== "unpaid") && <PayStateBadge state={pay.state} />}
                  </div>
                  <p className="num text-sm text-slate-500">
                    {formatDate(o.createdAt)} · {t("{n} pcs", { n: itemCount })} · <b className="text-slate-800">{formatINR(o.total)}</b>
                  </p>
                </div>
                <ChevronRight className="size-5 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
