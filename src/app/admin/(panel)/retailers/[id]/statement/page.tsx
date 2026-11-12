import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { RANGES, StatementSheet } from "@/components/Khata";
import { getT } from "@/lib/i18n-server";
import { getLedger, getRetailer, rangeFromParam } from "@/lib/khata";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Statement" };

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const r = Number.isInteger(id) ? await getRetailer(id) : null;
  if (!r || r.role !== "retailer") notFound();
  const range = rangeFromParam(sp.range ?? "all");
  const [ledger, s, t] = await Promise.all([getLedger(id, range), getSettings(), getT()]);
  const label = t(RANGES.find((x) => x.key === range.key)?.label ?? "All time");
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex items-center justify-between gap-2">
        <Link href={`/admin/retailers/${id}?range=${range.key}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500">
          <ArrowLeft className="size-4" /> {t("Back")}
        </Link>
        <PrintButton />
      </div>
      <StatementSheet ledger={ledger} shop={s} customer={r} periodLabel={label} />
    </div>
  );
}
