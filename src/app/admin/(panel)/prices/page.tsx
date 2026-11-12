import { FileDown, FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PriceEditor } from "@/components/admin/PriceEditor";
import { getAllVariantsForAdmin } from "@/lib/admin-data";
import { getCategoriesWithCounts } from "@/lib/catalog";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Prices & stock" };

export default async function PricesPage() {
  const [rows, cats, t] = await Promise.all([getAllVariantsForAdmin(), getCategoriesWithCounts(), getT()]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Today's prices & stock")}</h1>
          <p className="text-sm text-slate-500">{t("Change any rate or piece count, then press Save once. Retailers see it instantly.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/prices/import" className="btn btn-gold btn-sm">
            <FileSpreadsheet className="size-4" /> {t("Upload Excel / Tally")}
          </Link>
          <a href="/api/admin/export/prices" className="btn btn-outline btn-sm">
            <FileDown className="size-4" /> {t("Download Excel")}
          </a>
        </div>
      </div>
      <PriceEditor
        rows={rows.map((r) => ({ ...r, priceUpdatedAt: new Date(r.priceUpdatedAt).toISOString() }))}
        cats={cats.filter((c) => c.count > 0).map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
