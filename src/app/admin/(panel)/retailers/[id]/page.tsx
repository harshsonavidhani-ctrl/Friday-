import { ArrowLeft, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KhataActions } from "@/components/admin/KhataActions";
import { RetailerActions } from "@/components/admin/RetailerAdmin";
import { OrderStatusBadge } from "@/components/Badges";
import { BalanceText, LedgerList, RangeChips } from "@/components/Khata";
import { formatDate, formatINR, orderNo, waLink } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getDueOrders, getLedger, getRetailer, rangeFromParam } from "@/lib/khata";
import { listOrders } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Shop khata" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string; link?: string }> };

export default async function RetailerPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const r = Number.isInteger(id) ? await getRetailer(id) : null;
  if (!r || r.role !== "retailer") notFound();
  const range = rangeFromParam(sp.range ?? "all");
  const [ledger, due, recent, s, base, t] = await Promise.all([
    getLedger(id, range),
    getDueOrders(id),
    listOrders({ userId: id, limit: 8 }),
    getSettings(),
    siteUrl(),
    getT(),
  ]);
  const lastOrder = recent[0]?.order.createdAt;

  return (
    <div className="space-y-4">
      <Link href="/admin/retailers" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-800">
        <ArrowLeft className="size-4" /> {t("Retailers")}
      </Link>

      <section className="card space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{r.shopName || r.name}</h1>
            <p className="text-sm text-slate-600">
              {r.name} · <span className="num">{r.phone}</span>
              {r.gstin && <span className="num"> · GSTIN {r.gstin}</span>}
            </p>
            {(r.address || r.city) && (
              <p className="mt-0.5 flex gap-1 text-sm text-slate-500">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                {[r.address, r.city].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="text-xs text-slate-400">{t("Joined {date}", { date: formatDate(r.createdAt, false) })}</p>
          </div>
          <span
            className={`badge ${
              r.status === "approved"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : r.status === "pending"
                  ? "bg-gold-50 text-gold-800 ring-gold-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200"
            }`}
          >
            {t(r.status === "approved" ? "Approved" : r.status === "pending" ? "Waiting approval" : "Blocked")}
          </span>
        </div>
        {sp.link && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
            {t("This shop asked for a login link. Tap “Login link”, then “Send on WhatsApp”.")}
          </p>
        )}
        <RetailerActions r={r} shopName={s.shopName} siteUrl={base} highlightLink={!!sp.link} />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card col-span-2 p-4 lg:col-span-1">
          <p className="text-xs font-semibold text-slate-500">{t("Balance")}</p>
          <p className="num mt-1 text-2xl font-extrabold">
            <BalanceText amount={ledger.balance} />
          </p>
        </div>
        <Stat label={t("Bills (this period)")} value={formatINR(ledger.debit)} />
        <Stat label={t("Paid (this period)")} value={formatINR(ledger.credit)} />
        <Stat label={t("Last order")} value={lastOrder ? formatDate(lastOrder, false) : "—"} small />
      </div>

      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="font-bold text-brand-950">{t("Khata")}</h2>
        <KhataActions
          userId={r.id}
          name={r.name}
          phone={r.phone}
          balance={ledger.balance}
          due={due.map((d) => ({ no: orderNo(d.id), date: formatDate(d.createdAt, false), due: d.due }))}
          shopName={s.shopName}
          siteUrl={base}
          printHref={`/admin/retailers/${r.id}/statement?range=${range.key}`}
        />
      </section>

      <RangeChips active={range.key} href={(k) => `/admin/retailers/${r.id}?range=${k}`} />
      <LedgerList ledger={ledger} orderHref={(oid) => `/admin/orders/${oid}`} />

      {ledger.pending.length > 0 && (
        <p className="rounded-2xl bg-gold-50 px-4 py-3 text-sm text-gold-900 ring-1 ring-gold-200">
          {t("Not in khata yet (awaiting your confirmation):")}{" "}
          {ledger.pending.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <Link href={`/admin/orders/${p.id}`} className="font-semibold underline">
                {orderNo(p.id)}
              </Link>{" "}
              {formatINR(p.total)}
            </span>
          ))}
        </p>
      )}

      <section className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="font-bold text-brand-950">{t("Recent orders")}</h2>
          <a href={waLink(r.phone, `${t("Namaste")} ${r.name}, `)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <MessageCircle className="size-4 text-[#1fa855]" /> WhatsApp
          </a>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">{t("No orders yet.")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map(({ order: o, itemCount, pay }) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{orderNo(o.id)}</p>
                    <p className="num text-xs text-slate-500">
                      {formatDate(o.createdAt)} · {t("{n} pcs", { n: itemCount })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num text-sm font-bold">{formatINR(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                    {pay.balance > 0 && o.status !== "cancelled" && o.status !== "pending" && (
                      <span className="num text-xs font-semibold text-rose-600">{t("Due {amount}", { amount: formatINR(pay.balance) })}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`num mt-1 font-extrabold text-brand-950 ${small ? "text-base" : "text-xl"}`}>{value}</p>
    </div>
  );
}
