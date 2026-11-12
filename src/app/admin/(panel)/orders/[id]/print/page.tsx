import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { PAY_PLAN_LABEL } from "@/lib/constants";
import { formatDate, formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getOrderDetails } from "@/lib/orders";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Print order" };

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await getOrderDetails(id) : null;
  if (!d) notFound();
  const [s, t] = await Promise.all([getSettings(), getT()]);
  const o = d.order;
  const c = d.customer;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>
      <div className="bg-white p-6 text-sm text-slate-900 ring-1 ring-slate-200 print:p-0 print:ring-0">
        <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
          <div>
            <p className="text-xl font-extrabold">{s.shopName}</p>
            {s.address && <p>{[s.address, s.city].filter(Boolean).join(", ")}</p>}
            {s.phone && (
              <p>
                {t("Phone")}: {s.phone}
              </p>
            )}
            {s.gstin && <p>GSTIN: {s.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{t("ORDER / ESTIMATE")}</p>
            <p>
              {t("No")}: {orderNo(o.id)}
            </p>
            <p>
              {t("Date")}: {formatDate(o.createdAt, false)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-b border-slate-300 py-4">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">{t("Bill to")}</p>
            <p className="font-semibold">{c.shopName}</p>
            <p>
              {c.name} · {c.phone}
            </p>
            {c.gstin && <p>GSTIN: {c.gstin}</p>}
            {(c.address || c.city) && <p>{[c.address, c.city].filter(Boolean).join(", ")}</p>}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">{t("Delivery")}</p>
            <p>{o.deliveryMethod === "parcel" ? t("Parcel") : t("Pickup from shop")}</p>
            {o.address && <p>{o.address}</p>}
            {o.transportInfo && (
              <p>
                {t("Transport")}: {o.transportInfo}
              </p>
            )}
            <p>
              {t("Payment")}: {t(PAY_PLAN_LABEL[o.payPlan])}
            </p>
          </div>
        </div>
        <table className="num mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs text-slate-500 uppercase">
              <th className="py-2">#</th>
              <th className="py-2">{t("Item")}</th>
              <th className="py-2 text-right">{t("Qty")}</th>
              <th className="py-2 text-right">{t("Rate")}</th>
              <th className="py-2 text-right">{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((i, idx) => (
              <tr key={i.id} className="border-b border-slate-200 align-top">
                <td className="py-2 pr-2">{idx + 1}</td>
                <td className="py-2">
                  {i.name}
                  {i.variantLabel ? ` (${i.variantLabel})` : ""}
                  {i.serials.length > 0 && (
                    <p className="mt-0.5 text-[11px] leading-snug break-all text-slate-600">
                      IMEI/SN: {i.serials.map((x) => x.serial).join(", ")}
                    </p>
                  )}
                </td>
                <td className="py-2 text-right">{i.qty}</td>
                <td className="py-2 text-right">{formatINR(i.price)}</td>
                <td className="py-2 text-right">{formatINR(i.price * i.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="num mt-4 ml-auto w-64 space-y-1">
          <Line k={t("Items total")} v={formatINR(o.subtotal)} />
          {o.parcelCharge > 0 && <Line k={t("Parcel / transport")} v={formatINR(o.parcelCharge)} />}
          {o.discount > 0 && <Line k={t("Discount")} v={`− ${formatINR(o.discount)}`} />}
          <div className="flex justify-between border-t border-slate-400 pt-1 text-base font-bold">
            <span>{t("Total")}</span>
            <span>{formatINR(o.total)}</span>
          </div>
          {d.pay.verified > 0 && <Line k={t("Paid")} v={formatINR(d.pay.verified)} />}
          <Line k={t("Balance")} v={formatINR(Math.max(0, o.total - d.pay.verified))} />
        </div>
        <p className="mt-8 text-xs text-slate-500">{t("This is an order summary. GST tax invoice is issued separately.")}</p>
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
