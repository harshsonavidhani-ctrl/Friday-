import { ArrowDownLeft, ArrowUpRight, CircleCheck } from "lucide-react";
import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";
import type { getLedger } from "@/lib/khata";

export type Ledger = Awaited<ReturnType<typeof getLedger>>;

export const RANGES = [
  { key: "month", label: "This month" },
  { key: "3m", label: "Last 3 months" },
  { key: "fy", label: "This financial year" },
  { key: "all", label: "All time" },
] as const;

export async function BalanceText({ amount, className = "" }: { amount: number; className?: string }) {
  const t = await getT();
  if (amount > 0) return <span className={`text-rose-700 ${className}`}>{t("{amount} due", { amount: formatINR(amount) })}</span>;
  if (amount < 0) return <span className={`text-emerald-700 ${className}`}>{t("{amount} advance", { amount: formatINR(-amount) })}</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-emerald-700 ${className}`}>
      <CircleCheck className="size-4" /> {t("Settled")}
    </span>
  );
}

/** Phone-friendly ledger list (also prints well). */
export async function LedgerList({ ledger, orderHref }: { ledger: Ledger; orderHref: (id: number) => string }) {
  const t = await getT();
  return (
    <div className="card overflow-hidden">
      <div className="num flex items-center justify-between bg-slate-50 px-4 py-2.5 text-sm">
        <span className="font-semibold text-slate-600">{t("Opening balance")}</span>
        <b className="text-slate-900">{formatINR(ledger.opening)}</b>
      </div>
      {ledger.entries.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">{t("No entries in this period.")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {ledger.entries.map((e, i) => (
            <li key={`${e.kind}-${e.orderId}-${i}`} className="flex items-start gap-3 px-4 py-3">
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  e.kind === "order" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {e.kind === "order" ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {e.kind === "order" ? t("Bill") : t("Payment received")} ·{" "}
                  <Link href={orderHref(e.orderId)} className="text-brand-700 hover:underline">
                    {e.ref}
                  </Link>
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(e.date, false)}
                  {e.kind === "order" ? ` · ${t("{n} pcs", { n: e.pcs })}` : ""}
                  {e.method ? ` · ${t(PAYMENT_METHOD_LABEL[e.method])}` : ""}
                  {e.detail ? ` · ${e.detail}` : ""}
                </p>
              </div>
              <div className="num text-right">
                <p className={`text-sm font-bold ${e.kind === "order" ? "text-rose-700" : "text-emerald-700"}`}>
                  {e.kind === "order" ? "+ " : "− "}
                  {formatINR(e.debit || e.credit)}
                </p>
                <p className="text-xs text-slate-500">
                  {t("Bal")} {formatINR(e.balance)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="num space-y-1 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>{t("Bills in this period")}</span>
          <span className="font-semibold">{formatINR(ledger.debit)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>{t("Paid in this period")}</span>
          <span className="font-semibold">{formatINR(ledger.credit)}</span>
        </div>
        <div className="flex justify-between pt-1 text-base font-extrabold text-brand-950">
          <span>{t("Closing balance")}</span>
          <span>{formatINR(ledger.closing)}</span>
        </div>
      </div>
    </div>
  );
}

export async function RangeChips({ active, href }: { active: string; href: (key: string) => string }) {
  const t = await getT();
  return (
    <div className="no-print no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {RANGES.map((r) => (
        <Link key={r.key} href={href(r.key)} className={`chip ${active === r.key ? "chip-active" : ""}`} scroll={false}>
          {t(r.label)}
        </Link>
      ))}
    </div>
  );
}

/** A4 statement for printing / Save as PDF. */
export async function StatementSheet({
  ledger,
  shop,
  customer,
  periodLabel,
}: {
  ledger: Ledger;
  shop: { shopName: string; address: string; city: string; phone: string; gstin: string };
  customer: { shopName: string; name: string; phone: string; gstin: string; address: string; city: string };
  periodLabel: string;
}) {
  const t = await getT();
  return (
    <div className="bg-white p-6 text-sm text-slate-900 ring-1 ring-slate-200 print:p-0 print:ring-0">
      <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <p className="text-xl font-extrabold">{shop.shopName}</p>
          {shop.address && <p>{[shop.address, shop.city].filter(Boolean).join(", ")}</p>}
          {shop.phone && <p>{t("Phone")}: {shop.phone}</p>}
          {shop.gstin && <p>GSTIN: {shop.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{t("ACCOUNT STATEMENT")}</p>
          <p>{periodLabel}</p>
          <p>
            {t("Printed")}: {formatDate(new Date(), false)}
          </p>
        </div>
      </div>
      <div className="border-b border-slate-300 py-3">
        <p className="font-semibold">{customer.shopName || customer.name}</p>
        <p>
          {customer.name} · {customer.phone}
        </p>
        {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
        {(customer.address || customer.city) && <p>{[customer.address, customer.city].filter(Boolean).join(", ")}</p>}
      </div>
      <table className="num mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs text-slate-500 uppercase">
            <th className="py-2">{t("Date")}</th>
            <th className="py-2">{t("Particulars")}</th>
            <th className="py-2 text-right">{t("Debit")}</th>
            <th className="py-2 text-right">{t("Credit")}</th>
            <th className="py-2 text-right">{t("Balance")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="py-1.5" />
            <td className="py-1.5 font-semibold">{t("Opening balance")}</td>
            <td />
            <td />
            <td className="py-1.5 text-right font-semibold">{formatINR(ledger.opening)}</td>
          </tr>
          {ledger.entries.map((e, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(e.date, false)}</td>
              <td className="py-1.5">
                {e.kind === "order"
                  ? `${t("Bill")} ${e.ref} (${t("{n} pcs", { n: e.pcs })})`
                  : `${t("Payment")} ${e.ref}${e.method ? ` · ${t(PAYMENT_METHOD_LABEL[e.method])}` : ""}${e.detail ? ` · ${e.detail}` : ""}`}
              </td>
              <td className="py-1.5 text-right">{e.debit ? formatINR(e.debit) : ""}</td>
              <td className="py-1.5 text-right">{e.credit ? formatINR(e.credit) : ""}</td>
              <td className="py-1.5 text-right">{formatINR(e.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-bold">
            <td />
            <td className="py-2">{t("Closing balance")}</td>
            <td className="py-2 text-right">{formatINR(ledger.debit)}</td>
            <td className="py-2 text-right">{formatINR(ledger.credit)}</td>
            <td className="py-2 text-right">{formatINR(ledger.closing)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-8 text-xs text-slate-500">
        {t("Positive balance = amount due to {shop}. Orders awaiting confirmation are not included.", { shop: shop.shopName })}
      </p>
    </div>
  );
}
