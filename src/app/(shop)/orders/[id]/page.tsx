import { Check, CircleCheck, MessageCircle, Phone, ScanBarcode, Store, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusBadge } from "@/components/Badges";
import { OrderTimeline, OrderTotals, PaymentsList } from "@/components/OrderParts";
import { ProductImage } from "@/components/ProductImage";
import { PushToggle } from "@/components/PushToggle";
import { CancelOrder } from "@/components/shop/CancelOrder";
import { PaymentPanel } from "@/components/shop/PaymentPanel";
import { requireUser } from "@/lib/auth";
import { PAY_PLAN_LABEL } from "@/lib/constants";
import { formatDate, formatINR, orderNo, telLink, waLink } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getOrderDetails } from "@/lib/orders";
import { getVapidKeys } from "@/lib/push";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; paid?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${orderNo(Number((await params).id) || 0)}` };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const user = await requireUser(`/orders/${id}`);
  const d = Number.isInteger(id) ? await getOrderDetails(id) : null;
  if (!d || (d.order.userId !== user.id && user.role !== "admin")) notFound();
  const { placed, paid } = await searchParams;
  const [s, t, keys] = await Promise.all([getSettings(), getT(), getVapidKeys()]);
  const o = d.order;
  const no = orderNo(o.id);
  const shopWa = s.whatsapp || s.phone;

  // the WhatsApp copy goes to Mama — kept in English
  const waText = [
    `*New order ${no}*`,
    `${d.customer.shopName} (${d.customer.name}, ${d.customer.phone})`,
    "",
    ...d.items.map((i) => `• ${i.name}${i.variantLabel ? ` ${i.variantLabel}` : ""} × ${i.qty} = ${formatINR(i.price * i.qty)}`),
    "",
    `Total: ${formatINR(o.total)}`,
    o.deliveryMethod === "parcel" ? `Parcel to: ${o.address}` : "Pickup from shop",
    `Payment: ${PAY_PLAN_LABEL[o.payPlan]}`,
    o.notes ? `Note: ${o.notes}` : "",
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  // Payment opens right after the order is placed (no need to wait for confirmation).
  const canPay = o.status !== "cancelled" && d.pay.balance > 0;
  const payFirst = !!placed && !paid && (o.payPlan === "upi" || o.payPlan === "bank");
  const paySection = canPay && (
        <section className="card space-y-3 p-4 sm:p-5">
          <h2 className="text-lg font-bold text-brand-950">{t("Pay {amount}", { amount: formatINR(d.pay.balance) })}</h2>
          <p className="-mt-2 text-sm text-slate-500">{t("Choose how you want to pay:")}</p>
          {o.payPlan === "credit" && (
            <p className="rounded-xl bg-gold-50 px-3.5 py-2.5 text-sm text-gold-900 ring-1 ring-gold-200">
              {t("You asked for credit (udhaar). Pay any time using any option below.")}
            </p>
          )}
          <PaymentPanel
            key={d.pay.balance}
            defaultMode={o.payPlan === "bank" ? "bank" : o.payPlan === "cash" ? "cash" : "upi"}
            deliveryMethod={o.deliveryMethod}
            isAdmin={user.role === "admin"}
            ownerName={s.ownerName}
            orderId={o.id}
            orderNo={no}
            balance={d.pay.balance}
            upiId={s.upiId}
            upiName={s.upiName || s.shopName}
            upiLimit={Number(s.upiLimit) || 100000}
            bank={{ name: s.bankName, accountName: s.bankAccountName, accountNumber: s.bankAccountNumber, ifsc: s.bankIfsc }}
          />
        </section>
      
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {placed && (o.status === "pending" || o.status === "confirmed") && (
        <div className="card space-y-3 bg-emerald-50 p-5 ring-emerald-200">
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Check className="size-8" strokeWidth={3} />
            </span>
            <div>
              <p className="text-2xl font-black text-emerald-900">{o.status === "confirmed" ? t("Order confirmed ✓") : t("Order placed!")}</p>
              <p className="num text-base font-bold text-emerald-800">
                {no} · {formatINR(o.total)}
              </p>
            </div>
          </div>
          <p className="rounded-xl bg-white/70 px-3 py-2 text-base font-semibold text-slate-800">
            {paid || d.pay.submitted > 0
              ? t("Payment sent ✓ — {name} will check it.", { name: s.ownerName })
              : o.payPlan === "cash"
                ? t("Pay {amount} in cash when you collect.", { amount: formatINR(d.pay.balance) })
                : o.payPlan === "credit"
                  ? t("On credit (udhaar) — pay any time from this page.")
                  : t("Pay online below — or any time from this page.")}
          </p>
          <p className="text-sm text-emerald-900">
            {o.status === "confirmed"
              ? t("{name} will pack it. You will get an update when it is ready / dispatched.", { name: s.ownerName })
              : t("{name} will confirm your order soon. For a faster reply, send it on WhatsApp too.", { name: s.ownerName })}
          </p>
          {shopWa && (
            <a href={waLink(shopWa, waText)} target="_blank" rel="noreferrer" className="btn btn-whatsapp">
              <MessageCircle className="size-4" /> {t("Send order on WhatsApp")}
            </a>
          )}
          <div className="border-t border-emerald-200 pt-3">
            <p className="mb-2 text-sm font-semibold text-emerald-900">{t("Get an alert when it is confirmed and dispatched:")}</p>
            <PushToggle publicKey={keys.publicKey} compact />
          </div>
        </div>
      )}

      {/* just placed with Online but not paid yet → payment comes first */}
      {payFirst && paySection}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">
            {t("Order")} {no}
          </h1>
          <p className="text-sm text-slate-500">{t("Placed {date}", { date: formatDate(o.createdAt) })}</p>
        </div>
        <OrderStatusBadge status={o.status} />
      </div>

      <div className="card space-y-4 p-4 sm:p-5">
        <OrderTimeline status={o.status} method={o.deliveryMethod} />
        <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          {o.deliveryMethod === "parcel" ? <Truck className="mt-0.5 size-4 shrink-0" /> : <Store className="mt-0.5 size-4 shrink-0" />}
          <div>
            <p className="font-semibold">{o.deliveryMethod === "parcel" ? t("Parcel") : t("Pickup from shop")}</p>
            {o.address && <p className="text-slate-600">{o.address}</p>}
            {o.transportInfo && (
              <p className="mt-1 font-medium text-brand-800">
                {t("Transport / LR")}: {o.transportInfo}
              </p>
            )}
            <p className="mt-1 text-slate-600">
              {t("Payment")}: <b>{t(PAY_PLAN_LABEL[o.payPlan])}</b>
            </p>
            {o.notes && (
              <p className="mt-1 text-slate-500">
                {t("Your note")}: {o.notes}
              </p>
            )}
          </div>
        </div>
        {o.status === "pending" && (
          <p className="text-sm text-slate-600">
            {t("Waiting for {name} to confirm. You can pay now — if parcel charges are added later, only the extra will show as due.", {
              name: s.ownerName,
            })}
          </p>
        )}
      </div>

      <div className="card divide-y divide-slate-100">
        {d.items.map((i) => (
          <div key={i.id} className="flex items-start gap-3 p-3 sm:p-4">
            <ProductImage src={i.image} alt={i.name} className="size-14 shrink-0 rounded-lg ring-1 ring-slate-100" />
            <div className="min-w-0 flex-1">
              {i.productId ? (
                <Link href={`/p/${i.productId}`} className="line-clamp-1 text-sm font-semibold text-slate-900 hover:text-brand-800">
                  {i.name}
                </Link>
              ) : (
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{i.name}</p>
              )}
              {i.variantLabel && <p className="text-xs text-slate-500">{i.variantLabel}</p>}
              <p className="num text-xs text-slate-500">
                {formatINR(i.price)} × {i.qty}
              </p>
              {i.serials.length > 0 && (
                <details className="mt-1 text-xs">
                  <summary className="inline-flex cursor-pointer items-center gap-1 font-semibold text-brand-700">
                    <ScanBarcode className="size-3.5" /> {t("IMEI / serial ({n})", { n: i.serials.length })}
                  </summary>
                  <p className="num mt-1 break-all text-slate-600">{i.serials.map((x) => x.serial).join(", ")}</p>
                </details>
              )}
            </div>
            <p className="num text-sm font-bold text-slate-900">{formatINR(i.price * i.qty)}</p>
          </div>
        ))}
        <div className="p-4 sm:p-5">
          <OrderTotals d={d} />
        </div>
      </div>

      {d.pay.submitted > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          <span>
            {t("{amount} payment received from you — {name} will verify it shortly.", { amount: formatINR(d.pay.submitted), name: s.ownerName })}
            {d.pay.balance > 0 && <> {t("Remaining {amount} can be paid below.", { amount: formatINR(d.pay.balance) })}</>}
          </span>
        </p>
      )}

      {!payFirst && paySection}

      {d.payments.length > 0 && (
        <section className="card p-4 sm:p-5">
          <h2 className="mb-1 font-bold text-brand-950">{t("Payments")}</h2>
          <PaymentsList payments={d.payments} />
        </section>
      )}

      <div className="flex flex-wrap items-start gap-2">
        {shopWa && (
          <a href={waLink(shopWa, `Hello, about my order ${no}: `)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
            <MessageCircle className="size-4 text-[#1fa855]" /> {t("WhatsApp shop")}
          </a>
        )}
        {s.phone && (
          <a href={telLink(s.phone)} className="btn btn-outline btn-sm">
            <Phone className="size-4" /> {t("Call shop")}
          </a>
        )}
        {o.status === "pending" && o.userId === user.id && <CancelOrder orderId={o.id} />}
      </div>
    </div>
  );
}
