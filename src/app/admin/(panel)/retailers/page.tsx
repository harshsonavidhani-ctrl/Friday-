import type { Metadata } from "next";
import Link from "next/link";
import { AddRetailerForm, RetailerCard } from "@/components/admin/RetailerAdmin";
import { getRetailers } from "@/lib/admin-data";
import { formatINR } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Retailers" };

const TABS = [
  { key: "pending", label: "Waiting approval" },
  { key: "approved", label: "Approved" },
  { key: "collect", label: "To collect" },
  { key: "blocked", label: "Blocked" },
] as const;

export default async function RetailersPage({ searchParams }: { searchParams: Promise<{ tab?: string; add?: string; q?: string }> }) {
  const sp = await searchParams;
  const [all, s, base, t] = await Promise.all([getRetailers(), getSettings(), siteUrl(), getT()]);
  const counts = { pending: 0, approved: 0, blocked: 0, collect: 0 };
  let toCollect = 0;
  for (const r of all) {
    counts[r.status]++;
    if (r.outstanding > 0) {
      counts.collect++;
      toCollect += r.outstanding;
    }
  }
  const tab = (TABS.find((x) => x.key === sp.tab)?.key ?? (counts.pending ? "pending" : "approved")) as keyof typeof counts;
  const q = (sp.q ?? "").toLowerCase();
  const rows = all
    .filter((r) => (tab === "collect" ? r.outstanding > 0 : r.status === tab))
    .filter((r) => !q || `${r.shopName} ${r.name} ${r.phone} ${r.city}`.toLowerCase().includes(q))
    .sort((a, b) => (tab === "collect" ? b.outstanding - a.outstanding : 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Retailers & khata")}</h1>
        {toCollect > 0 && (
          <Link href="/admin/retailers?tab=collect" className="badge num bg-rose-50 py-1 text-sm text-rose-700 ring-rose-200">
            {t("Total to collect {amount}", { amount: formatINR(toCollect) })}
          </Link>
        )}
      </div>
      <AddRetailerForm shopName={s.shopName} siteUrl={base} open={!!sp.add} />
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((x) => (
          <Link key={x.key} href={`/admin/retailers?tab=${x.key}`} className={`chip ${x.key === tab ? "chip-active" : ""}`}>
            {t(x.label)} <span className="num text-xs opacity-70">{counts[x.key]}</span>
          </Link>
        ))}
        <form className="w-full sm:ml-auto sm:w-auto">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={sp.q} placeholder={t("Search shop / phone")} className="input py-1.5 text-sm" type="search" />
        </form>
      </div>
      <ul className="card divide-y divide-slate-100">
        {rows.map((r) => (
          <RetailerCard key={`${r.id}-${r.status}`} r={{ ...r, createdAt: new Date(r.createdAt).toISOString() }} shopName={s.shopName} siteUrl={base} />
        ))}
        {rows.length === 0 && <li className="p-8 text-center text-sm text-slate-500">{t("No retailers here.")}</li>}
      </ul>
    </div>
  );
}
