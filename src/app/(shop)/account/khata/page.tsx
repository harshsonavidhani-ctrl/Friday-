import { ArrowLeft, IndianRupee } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/admin/PrintButton";
import { BalanceText, LedgerList, RangeChips, RANGES, StatementSheet } from "@/components/Khata";
import { requireUser } from "@/lib/auth";
import { formatDate, formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getDueOrders, getLedger, rangeFromParam } from "@/lib/khata";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "My khata" };

export default async function MyKhataPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const me = await requireUser("/account/khata");
  const sp = await searchParams;
  const range = rangeFromParam(sp.range ?? "all");
  const [ledger, due, s, t] = await Promise.all([getLedger(me.id, range), getDueOrders(me.id), getSettings(), getT()]);
  const label = t(RANGES.find((x) => x.key === range.key)?.label ?? "All time");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print space-y-4">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-800">
          <ArrowLeft className="size-4" /> {t("My account")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{t("My khata")}</h1>
            <p className="text-sm text-slate-500">{t("All your bills and payments with {shop}.", { shop: s.shopName })}</p>
          </div>
          <PrintButton className="btn btn-outline btn-sm" />
        </div>

        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold text-slate-500">{t("Your balance")}</p>
            <p className="num text-2xl font-extrabold">
              <BalanceText amount={ledger.balance} />
            </p>
          </div>
          {due[0] && (
            <Link href={`/orders/${due[0].id}`} className="btn btn-primary">
              <IndianRupee className="size-4" /> {t("Pay now")}
            </Link>
          )}
        </div>

        {due.length > 0 && (
          <section className="card divide-y divide-slate-100">
            <h2 className="px-4 py-3 font-bold text-brand-950">{t("Orders with money due")}</h2>
            {due.map((d) => (
              <Link key={d.id} href={`/orders/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{orderNo(d.id)}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(d.createdAt, false)} · {t("Total {amount}", { amount: formatINR(d.total) })}
                  </p>
                </div>
                <span className="num text-sm font-bold text-rose-700">{t("Pay {amount}", { amount: formatINR(d.due) })}</span>
              </Link>
            ))}
          </section>
        )}

        <RangeChips active={range.key} href={(k) => `/account/khata?range=${k}`} />
        <LedgerList ledger={ledger} orderHref={(id) => `/orders/${id}`} />
      </div>

      <div className="hidden print:block">
        <StatementSheet ledger={ledger} shop={s} customer={me} periodLabel={label} />
      </div>
    </div>
  );
}
