import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoPhotos } from "@/components/admin/AutoPhotos";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { ProductImage } from "@/components/ProductImage";
import { getCategoriesWithCounts, listProducts } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "All products" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; nophoto?: string }>;
}) {
  const { q = "", cat, nophoto } = await searchParams;
  const catId = Number(cat) || null;
  const [cats, all, s, t] = await Promise.all([
    getCategoriesWithCounts(),
    listProducts({ q, categoryId: catId, includeHidden: true, sort: "new", limit: 1000 }),
    getSettings(),
    getT(),
  ]);
  const items = nophoto ? all.filter((p) => p.images.length === 0) : all;
  const missing = all.filter((p) => p.images.length === 0).map((p) => p.id);
  const photoReady = !!(process.env.BRAVE_API_KEY || process.env.SERPER_API_KEY || s.braveApiKey || s.serperApiKey);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const iconOf = new Map(cats.map((c) => [c.id, c.icon]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("All products")}</h1>
          <p className="text-sm text-slate-500">{t("{n} models", { n: items.length })}</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-gold">
          <Plus className="size-4" /> {t("Add new model")}
        </Link>
      </div>

      <AutoPhotos ids={missing} ready={photoReady} />

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder={t("Search model, brand, model no.")} className="input pl-10" />
        </div>
        <select name="cat" defaultValue={catId ?? ""} className="input w-auto">
          <option value="">{t("All categories")}</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary">{t("Search")}</button>
      </form>
      {missing.length > 0 && (
        <div className="flex gap-2">
          <Link href="/admin/products" className={`chip ${!nophoto ? "chip-active" : ""}`}>
            {t("All")}
          </Link>
          <Link href="/admin/products?nophoto=1" className={`chip ${nophoto ? "chip-active" : ""}`}>
            {t("No photo")} <span className="num text-xs opacity-70">{missing.length}</span>
          </Link>
        </div>
      )}

      <ul className="card divide-y divide-slate-100">
        {items.map((p) => (
          <li key={p.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <Link href={`/admin/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <ProductImage src={p.images[0]} alt={p.name} icon={iconOf.get(p.categoryId ?? 0)} className="size-14 shrink-0 rounded-xl ring-1 ring-slate-100" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
                  <span className="truncate">{p.name}</span>
                  {!p.isActive && <span className="badge bg-slate-100 text-slate-600 ring-slate-200">{t("Hidden")}</span>}
                  {p.images.length === 0 && <span className="badge bg-gold-50 text-gold-800 ring-gold-200">{t("No photo")}</span>}
                </p>
                <p className="num text-xs text-slate-500">
                  {[p.brand, catName.get(p.categoryId ?? 0)].filter(Boolean).join(" · ")} · {t(p.variantCount === 1 ? "{n} variant" : "{n} variants", { n: p.variantCount })} ·{" "}
                  {formatINR(p.minPrice)}
                  {p.maxPrice !== p.minPrice ? ` – ${formatINR(p.maxPrice)}` : ""} ·{" "}
                  <span className={p.stock <= 0 ? "font-semibold text-rose-600" : ""}>{t("{n} pcs", { n: p.stock })}</span>
                </p>
              </div>
            </Link>
            <ProductRowActions id={p.id} isActive={p.isActive} />
          </li>
        ))}
        {items.length === 0 && <li className="p-8 text-center text-sm text-slate-500">{t("No products found.")}</li>}
      </ul>
    </div>
  );
}
