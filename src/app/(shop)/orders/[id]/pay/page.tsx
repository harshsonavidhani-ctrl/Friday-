import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PaymentPanel } from "@/components/shop/PaymentPanel";
import { requireUser } from "@/lib/auth";
import { formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getOrderDetails } from "@/lib/orders";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Pay online" };

/** Checkout step 3 for "Online": the exact-amount UPI QR (or bank details), then "Order confirmed". */
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await requireUser(`/orders/${id}/pay`);
  const d = Number.isInteger(id) ? await getOrderDetails(id) : null;
  if (!d || (d.order.userId !== user.id && user.role !== "admin")) notFound();
  if (d.order.status === "cancelled") redirect(`/orders/${id}?placed=1`);
  // nothing left to pay (e.g. the page refreshes right after "I have paid") → the confirmed screen
  if (d.pay.balance <= 0) redirect(`/orders/${id}?placed=1${d.pay.submitted > 0 || d.pay.verified > 0 ? "&paid=1" : ""}`);
  const [s, t] = await Promise.all([getSettings(), getT()]);
  const no = orderNo(id);
  const done = `/orders/${id}?placed=1&paid=1`;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ol className="grid grid-cols-3 gap-1 text-center text-xs font-bold">
        <li className="flex flex-col items-center gap-1 text-emerald-700">
          <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          {t("Order placed")}
        </li>
        <li className="flex flex-col items-center gap-1 text-brand-900">
          <span className="flex size-8 items-center justify-center rounded-full bg-gold-400 text-brand-950">2</span>
          {t("Pay online")}
        </li>
        <li className="flex flex-col items-center gap-1 text-slate-400">
          <span className="flex size-8 items-center justify-center rounded-full bg-slate-200">3</span>
          {t("Confirmed")}
        </li>
      </ol>

      <div className="card space-y-1 p-5 text-center">
        <p className="text-sm font-semibold text-slate-500">
          {t("Order")} {no}
        </p>
        <p className="num text-4xl font-black text-brand-950">{formatINR(d.pay.balance)}</p>
        <p className="text-sm text-slate-600">{t("Scan the QR with any UPI app, then enter the reference number below.")}</p>
      </div>

      <div className="card p-4 sm:p-5">
        <PaymentPanel
          orderId={id}
          orderNo={no}
          balance={d.pay.balance}
          upiId={s.upiId}
          upiName={s.upiName || s.shopName}
          upiLimit={Number(s.upiLimit) || 100000}
          bank={{ name: s.bankName, accountName: s.bankAccountName, accountNumber: s.bankAccountNumber, ifsc: s.bankIfsc }}
          defaultMode={d.order.payPlan === "bank" ? "bank" : "upi"}
          deliveryMethod={d.order.deliveryMethod}
          isAdmin={user.role === "admin"}
          ownerName={s.ownerName}
          doneHref={done}
        />
      </div>

      <p className="text-center text-sm">
        <Link href={`/orders/${id}?placed=1`} className="font-semibold text-slate-500 underline">
          {t("Pay later")}
        </Link>
      </p>
    </div>
  );
}
