import { Check } from "lucide-react";
import type { OrderStatus } from "@/db/schema";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import type { OrderDetails } from "@/lib/orders";

export async function OrderTimeline({ status, method }: { status: OrderStatus; method: "pickup" | "parcel" }) {
  const t = await getT();
  if (status === "cancelled") {
    return <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">{t("This order was cancelled.")}</p>;
  }
  const steps: { key: OrderStatus; label: string }[] = [
    { key: "pending", label: t("Placed") },
    { key: "confirmed", label: t("Confirmed") },
    method === "parcel" ? { key: "dispatched", label: t("Dispatched") } : { key: "ready", label: t("Ready") },
    { key: "completed", label: t("Completed") },
  ];
  const order: OrderStatus[] = ["pending", "confirmed", method === "parcel" ? "dispatched" : "ready", "completed"];
  // "ready"/"dispatched" are interchangeable for the timeline position
  const norm = status === "ready" || status === "dispatched" ? order[2] : status;
  const at = order.indexOf(norm);
  return (
    <ol className="grid grid-cols-4 gap-1">
      {steps.map((s, i) => {
        const done = i <= at;
        return (
          <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done ? "bg-emerald-500" : "bg-slate-200"}`} />
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? "opacity-0" : i < at ? "bg-emerald-500" : "bg-slate-200"}`} />
            </span>
            <span className={`text-xs font-semibold ${done ? "text-slate-800" : "text-slate-400"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export async function OrderTotals({ d }: { d: OrderDetails }) {
  const t = await getT();
  const o = d.order;
  return (
    <dl className="num space-y-1.5 text-sm">
      <Row k={t("Items total")} v={formatINR(o.subtotal)} />
      {o.parcelCharge > 0 && <Row k={t("Parcel / transport")} v={`+ ${formatINR(o.parcelCharge)}`} />}
      {o.discount > 0 && <Row k={t("Discount")} v={`− ${formatINR(o.discount)}`} />}
      <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-brand-950">
        <dt>{t("Order total")}</dt>
        <dd>{formatINR(o.total)}</dd>
      </div>
      {d.pay.verified > 0 && <Row k={t("Paid")} v={`− ${formatINR(d.pay.verified)}`} tone="text-emerald-700" />}
      {d.pay.submitted > 0 && <Row k={t("Payment being verified")} v={formatINR(d.pay.submitted)} tone="text-sky-700" />}
      {o.status !== "cancelled" && (
        <div className="flex justify-between pt-1 font-bold">
          <dt>{t("Balance due")}</dt>
          <dd className={d.pay.balance > 0 ? "text-rose-700" : "text-emerald-700"}>{formatINR(d.pay.balance)}</dd>
        </div>
      )}
      {d.pay.excess > 0 && <Row k={t("Paid extra (will be adjusted)")} v={formatINR(d.pay.excess)} tone="text-gold-700" />}
    </dl>
  );
}

function Row({ k, v, tone = "text-slate-600" }: { k: string; v: string; tone?: string }) {
  return (
    <div className={`flex justify-between ${tone}`}>
      <dt>{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

export async function PaymentsList({ payments }: { payments: OrderDetails["payments"] }) {
  const t = await getT();
  if (!payments.length) return null;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2">
          <div>
            <p className="num font-semibold text-slate-900">{formatINR(p.amount)}</p>
            <p className="text-xs text-slate-500">
              {t(PAYMENT_METHOD_LABEL[p.method])}
              {p.reference ? ` · ${p.reference}` : ""} · {formatDate(p.createdAt)}
            </p>
          </div>
          <span
            className={`badge ${
              p.status === "verified"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : p.status === "rejected"
                  ? "bg-rose-50 text-rose-700 ring-rose-200"
                  : "bg-sky-50 text-sky-700 ring-sky-200"
            }`}
          >
            {p.status === "verified" ? t("Received") : p.status === "rejected" ? t("Not received") : t("Verifying")}
          </span>
        </li>
      ))}
    </ul>
  );
}
