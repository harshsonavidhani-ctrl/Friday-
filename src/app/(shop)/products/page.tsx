import { PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import { FilterBar } from "@/components/shop/FilterBar";
import { ProductCard, ProductGrid } from "@/components/shop/ProductCard";
import { canSeePrices, getCurrentUser } from "@/lib/auth";
import { getBrands, getCategoriesWithCounts, listProducts, type ProductSort } from "@/lib/catalog";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Products" };

const SORTS: ProductSort[] = ["new", "price_asc", "price_desc", "name"];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const showPrice = canSeePrices(user);

  const q = get("q").slice(0, 80);
  const cat = Number(get("cat")) || null;
  const brand = get("brand");
  const stock = get("stock") === "1";
  let sort = (SORTS.includes(get("sort") as ProductSort) ? get("sort") : "new") as ProductSort;
  if (!showPrice && sort.startsWith("price")) sort = "new";

  const [cats, brands, items] = await Promise.all([
    getCategoriesWithCounts(),
    getBrands(),
    listProducts({ q, categoryId: cat, brand, inStock: stock, sort }),
  ]);
  const iconOf = new Map(cats.map((c) => [c.id, c.icon]));
  const catName = cats.find((c) => c.id === cat)?.name;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">
          {q ? t("Results for “{q}”", { q }) : catName ? t(catName) : t("All products")}
        </h1>
        <p className="text-sm text-slate-500">{t(items.length === 1 ? "{n} model" : "{n} models", { n: items.length })}</p>
      </div>
      <FilterBar cats={cats.map((c) => ({ ...c, name: t(c.name) }))} brands={brands} current={{ q, cat, brand, stock, sort }} allowPriceSort={showPrice} />
      {items.length ? (
        <ProductGrid>
          {items.map((p) => (
            <ProductCard key={p.id} p={p} showPrice={showPrice} icon={iconOf.get(p.categoryId ?? 0)} />
          ))}
        </ProductGrid>
      ) : (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-500">
          <PackageOpen className="size-10 text-slate-300" />
          <p className="font-semibold text-slate-700">{t("No models found")}</p>
          <p className="text-sm">{t("Try a different search or clear the filters.")}</p>
        </div>
      )}
    </div>
  );
}
