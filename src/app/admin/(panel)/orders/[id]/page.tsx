import { ArrowLeft, MapPin, MessageCircle, Phone, Printer, ScanBarcode, Store, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderEditor, PaymentsAdmin, StatusActions } from "@/components/admin/OrderAdmin";
import { SerialsEditor } from "@/components/admin/SerialsEditor";
import { OrderStatusBadge, PayStateBadge } from "@/components/Badges";
import { OrderTimeline, OrderTotals } from "@/components/OrderParts";
import { PAY_PLAN_LABEL } from "@/lib/constants";
import { formatDate, formatINR, orderNo, telLink, waLink } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getOrderDetails } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await getOrderDetails(id) : null;
  if (!d) notFound();
  const [s, base, t] = await Promise.all([getSettings(), siteUrl(), getT()]);
  const o = d.order;
  const c = d.customer;
  const no = orderNo(o.id);
  const link = `${base}/orders/${o.id}`;
  const sign = `— ${s.shopName}`;
  const v = { name: c.name, no, total: formatINR(o.total), link, sign, due: formatINR(d.pay.balance), info: o.transportInfo };

  const waText: Record<string, string> = {
    pending: t("Hello {name}, we received your order {no} ({total}). We will confirm shortly. {sign}", v),
    confirmed: t("Hello {name}, your order {no} is CONFIRMED.\nTotal: {total}\nPay by UPI / see details: {link}\n{sign}", v),
    dispatched: [
      t("Hello {name}, your order {no} has been DISPATCHED.", v),
      o.transportInfo ? t("Transport: {info}", v) : "",
      d.pay.balance > 0 ? t("Balance due: {due} — {link}", v) : "",
      sign,
    ]
      .filter(Boolean)
      .join("\n"),
    ready: [t("Hello {name}, your order {no} is READY for pickup at our shop.", v), d.pay.balance > 0 ? t("Amount: {due}", v) : "", sign]
      .filter(Boolean)
      .join("\n"),
    completed: t("Thank you {name}! Order {no} is completed. {sign}", v),
    cancelled: t("Hello {name}, your order {no} has been cancelled. Please call us for details. {sign}", v),
  };

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-800">
        <ArrowLeft className="size-4" /> {t("Orders")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">
            {t("Order")} {no}
          </h1>
          <p className="text-sm text-slate-500">{formatDate(o.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={o.status} />
          {o.status !== "cancelled" && (o.status !== "pending" || d.pay.state !== "unpaid") && <PayStateBadge state={d.pay.state} />}
          <Link href={`/admin/orders/${o.id}/print`} className="btn btn-outline btn-sm">
            <Printer className="size-4" /> {t("Print")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="card space-y-4 p-4 sm:p-5">
            <OrderTimeline status={o.status} method={o.deliveryMethod} />
            <StatusActions key={o.status} orderId={o.id} status={o.status} deliveryMethod={o.deliveryMethod} waPhone={c.phone} waText={waText} />
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="font-bold text-brand-950">{t("Items")}</h2>
            <p className="mb-1 text-xs text-slate-500">{t("You can change quantity or rate, and add parcel charges. Stock adjusts automatically.")}</p>
            <OrderEditor
              key={new Date(o.updatedAt).getTime()}
              orderId={o.id}
              status={o.status}
              items={d.items.map((i) => ({ id: i.id, name: i.name, variantLabel: i.variantLabel, image: i.image, price: i.price, qty: i.qty }))}
              parcelCharge={o.parcelCharge}
              discount={o.discount}
              transportInfo={o.transportInfo}
              deliveryMethod={o.deliveryMethod}
            />
          </section>

          {o.status !== "cancelled" && (
            <section className="card p-4 sm:p-5">
              <h2 className="flex items-center gap-2 font-bold text-brand-950">
                <ScanBarcode className="size-5" /> {t("IMEI / serial numbers")}
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                {t("Scan the box barcode while packing. Helps with warranty and returns — and printed on the bill.")}
              </p>
              <SerialsEditor
                editable={o.status !== "completed"}
                items={d.items.map((i) => ({ id: i.id, name: i.name, variantLabel: i.variantLabel, qty: i.qty, serials: i.serials }))}
              />
            </section>
          )}

          <section className="card p-4 sm:p-5">
            <h2 className="mb-2 font-bold text-brand-950">{t("Payments")}</h2>
            <PaymentsAdmin
              key={`${d.pay.balance}-${d.payments.length}`}
              orderId={o.id}
              balance={d.pay.balance}
              payments={d.payments.map((p) => ({ ...p, createdAt: new Date(p.createdAt).toISOString() }))}
            />
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-3 p-4 sm:p-5">
            <Link href={`/admin/retailers/${c.id}`} className="font-bold text-brand-950 hover:text-brand-700">
              {c.shopName || c.name}
            </Link>
            <div className="space-y-1.5 text-sm text-slate-700">
              <p>{c.name}</p>
              <p className="num">{c.phone}</p>
              {c.gstin && <p className="num text-slate-500">GSTIN {c.gstin}</p>}
              {(c.address || c.city) && (
                <p className="flex gap-1.5 text-slate-500">
                  <MapPin className="mt-0.5 size-4 shrink-0" /> {[c.address, c.city].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <a href={telLink(c.phone)} className="btn btn-outline btn-sm flex-1">
                <Phone className="size-4" /> {t("Call")}
              </a>
              <a
                href={waLink(c.phone, t("Hello {name}, about order {no}: ", { name: c.name, no }))}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm flex-1"
              >
                <MessageCircle className="size-4 text-[#1fa855]" /> WhatsApp
              </a>
            </div>
            <Link href={`/admin/retailers/${c.id}`} className="block text-center text-xs font-semibold text-brand-700 hover:underline">
              {t("Open khata")}
            </Link>
          </section>

          <section className="card space-y-2 p-4 text-sm sm:p-5">
            <p className="flex items-center gap-2 font-bold text-brand-950">
              {o.deliveryMethod === "parcel" ? <Truck className="size-4" /> : <Store className="size-4" />}
              {o.deliveryMethod === "parcel" ? t("Send parcel") : t("Pickup from shop")}
            </p>
            {o.address && <p className="whitespace-pre-line text-slate-600">{o.address}</p>}
            <p className="flex items-center gap-2 pt-1 text-slate-700">
              {t("Wants to pay by:")}
              <span className={`badge ${o.payPlan === "credit" ? "bg-gold-50 text-gold-800 ring-gold-200" : "bg-brand-50 text-brand-800 ring-brand-200"}`}>
                {t(PAY_PLAN_LABEL[o.payPlan])}
              </span>
            </p>
            {o.notes && (
              <p className="rounded-lg bg-gold-50 p-2.5 text-gold-900 ring-1 ring-gold-200">
                <b>{t("Retailer note:")}</b> {o.notes}
              </p>
            )}
          </section>

          <section className="card p-4 sm:p-5">
            <OrderTotals d={d} />
          </section>
        </div>
      </div>
    </div>
  );
}
