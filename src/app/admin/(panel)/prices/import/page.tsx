import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ImportTool } from "@/components/admin/ImportTool";
import { getAllVariantsForAdmin } from "@/lib/admin-data";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Excel / Tally import" };

export default async function ImportPage() {
  const [rows, t] = await Promise.all([getAllVariantsForAdmin(), getT()]);
  return (
    <div className="space-y-4">
      <Link href="/admin/prices" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-800">
        <ArrowLeft className="size-4" /> {t("Prices & stock")}
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Update prices from Excel / Tally")}</h1>
        <p className="text-sm text-slate-500">{t("Upload once — all rates and stock update together. Nothing is saved until you press Save.")}</p>
      </div>
      <ImportTool
        variants={rows.map((r) => ({
          id: r.id,
          productId: r.productId,
          name: r.name,
          brand: r.brand,
          label: r.label,
          modelNumber: r.modelNumber,
          price: r.price,
          mrp: r.mrp,
          stock: r.stock,
        }))}
      />
    </div>
  );
}
