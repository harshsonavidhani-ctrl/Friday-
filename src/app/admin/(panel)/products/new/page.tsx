import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { getBrands, getCategoriesWithCounts } from "@/lib/catalog";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Add new model" };

export default async function NewProductPage() {
  const [cats, brands, t] = await Promise.all([getCategoriesWithCounts(), getBrands(), getT()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Add new model")}</h1>
        <p className="text-sm text-slate-500">
          {t("Type the model name — brand, category and photos are filled in automatically. Then just enter the price.")}
        </p>
      </div>
      <ProductForm cats={cats.map((c) => ({ id: c.id, name: c.name }))} brands={brands} />
    </div>
  );
}
