import { ArrowLeft, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { getBrands, getCategoriesWithCounts, getProduct } from "@/lib/catalog";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await getProduct(id) : null;
  if (!p) notFound();
  const { saved } = await searchParams;
  const [cats, brands, t] = await Promise.all([getCategoriesWithCounts(), getBrands(), getT()]);
  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-800">
        <ArrowLeft className="size-4" /> {t("All products")}
      </Link>
      {saved && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <CircleCheck className="size-5" /> {t("Changes saved — the shop shows them now.")}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Edit")}: {p.name}</h1>
        <ProductRowActions id={p.id} isActive={p.isActive} afterDelete="/admin/products" />
      </div>
      <ProductForm
        key={`${new Date(p.updatedAt).getTime()}-${saved ?? ""}`}
        cats={cats.map((c) => ({ id: c.id, name: c.name }))}
        brands={brands}
        initial={{
          id: p.id,
          name: p.name,
          brand: p.brand,
          categoryId: p.categoryId,
          description: p.description,
          specs: p.specs,
          images: p.images,
          moq: p.moq,
          isActive: p.isActive,
          variants: p.variants.map((v) => ({
            id: v.id,
            label: v.label,
            kind: v.kind,
            modelNumber: v.modelNumber,
            price: v.price,
            mrp: v.mrp,
            stock: v.stock,
          })),
        }}
      />
    </div>
  );
}
