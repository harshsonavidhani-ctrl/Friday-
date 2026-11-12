import type { Metadata } from "next";
import { CategoryRow } from "@/components/admin/CategoryAdmin";
import { getDb, categories, products } from "@/db";
import { asc, eq, sql } from "drizzle-orm";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [db, t] = await Promise.all([getDb(), getT()]);
  const cats = await db
    .select({
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
      count: sql<number>`count(${products.id})`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Categories")}</h1>
        <p className="text-sm text-slate-500">{t("Categories with no products are hidden from the shop automatically.")}</p>
      </div>
      <div className="card">
        <CategoryRow />
      </div>
      <div className="card divide-y divide-slate-100">
        {cats.map((c) => (
          <CategoryRow key={`${c.id}-${c.name}-${c.icon}-${c.sortOrder}`} c={c} />
        ))}
      </div>
    </div>
  );
}
