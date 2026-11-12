import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { categories, getDb, products, variants } from "@/db";

export type ProductSort = "new" | "price_asc" | "price_desc" | "name";

export type ListOptions = {
  q?: string;
  categoryId?: number | null;
  brand?: string;
  inStock?: boolean;
  sort?: ProductSort;
  limit?: number;
  includeHidden?: boolean;
  priceDropsOnly?: boolean;
};

const minPrice = sql<number>`min(${variants.price})`.mapWith(Number);
const totalStock = sql<number>`coalesce(sum(${variants.stock}), 0)`.mapWith(Number);
const recentDrop = sql`(${variants.prevPrice} > ${variants.price} and ${variants.priceUpdatedAt} > now() - interval '3 days')`;

export async function listProducts(opts: ListOptions = {}) {
  const db = await getDb();
  const where: SQL[] = [];
  if (!opts.includeHidden) where.push(eq(products.isActive, true));
  if (opts.categoryId) where.push(eq(products.categoryId, opts.categoryId));
  if (opts.brand) where.push(eq(products.brand, opts.brand));
  // every typed word must appear in name, brand, variant label or model number
  const words = (opts.q ?? "")
    .trim()
    // "8/128" or "8+128" (how shops type it) → "8gb 128" (how variants are named)
    .replace(/(\d{1,2})\s*[/+]\s*(\d{2,4})/g, "$1gb $2")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  for (const w of words) {
    const hay = sql`(${products.name} || ' ' || ${products.brand} || ' ' || coalesce((select string_agg(v2.label || ' ' || v2.model_number, ' ') from variants v2 where v2.product_id = ${products.id}), ''))`;
    if (/^\d+gb$/i.test(w)) {
      // "8gb" must not match inside "128GB"
      where.push(sql`${hay} ~* ${`(^|[^0-9])${w}`}`);
    } else {
      const like = `%${w.replace(/[%_\\]/g, "\\$&")}%`;
      where.push(sql`${hay} ilike ${like}`);
    }
  }

  const having: SQL[] = [];
  if (opts.inStock) having.push(sql`coalesce(sum(${variants.stock}), 0) > 0`);
  if (opts.priceDropsOnly) having.push(sql`bool_or(${recentDrop})`);

  const order =
    opts.sort === "price_asc"
      ? [asc(minPrice)]
      : opts.sort === "price_desc"
        ? [desc(minPrice)]
        : opts.sort === "name"
          ? [asc(products.name)]
          : [desc(products.createdAt)];

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      images: products.images,
      categoryId: products.categoryId,
      moq: products.moq,
      isActive: products.isActive,
      createdAt: products.createdAt,
      isNew: sql<boolean>`${products.createdAt} > now() - interval '7 days'`,
      minPrice,
      maxPrice: sql<number>`max(${variants.price})`.mapWith(Number),
      mrpAtMin: sql<number | null>`(array_agg(${variants.mrp} order by ${variants.price}))[1]`,
      stock: totalStock,
      variantCount: sql<number>`count(${variants.id})`.mapWith(Number),
      priceDrop: sql<boolean>`coalesce(bool_or(${recentDrop}), false)`,
      lastPriceUpdate: sql<Date | string | null>`max(${variants.priceUpdatedAt})`,
    })
    .from(products)
    .leftJoin(variants, eq(variants.productId, products.id))
    .where(where.length ? and(...where) : undefined)
    .groupBy(products.id)
    .having(having.length ? and(...having) : undefined)
    .orderBy(...order, desc(products.id))
    .limit(opts.limit ?? 200);

  return rows.map((r) => ({ ...r, mrpAtMin: r.mrpAtMin == null ? null : Number(r.mrpAtMin) }));
}

export type ProductListItem = Awaited<ReturnType<typeof listProducts>>[number];

export const getProduct = cache(async (id: number) => {
  const db = await getDb();
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) return null;
  const vs = await db
    .select()
    .from(variants)
    .where(eq(variants.productId, id))
    .orderBy(asc(variants.sortOrder), asc(variants.id));
  const [cat] = p.categoryId
    ? await db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1)
    : [];
  return { ...p, variants: vs, category: cat ?? null };
});

export const getCategoriesWithCounts = cache(async () => {
  const db = await getDb();
  return db
    .select({
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
      count: sql<number>`count(${products.id}) filter (where ${products.isActive})`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
});

export const getBrands = cache(async () => {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ brand: products.brand })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.brand} <> ''`))
    .orderBy(asc(products.brand));
  return rows.map((r) => r.brand);
});

export const getLastPriceUpdate = cache(async (): Promise<Date | null> => {
  const db = await getDb();
  const [r] = await db
    .select({ t: sql<Date | string | null>`max(${variants.priceUpdatedAt})` })
    .from(variants);
  return r?.t ? new Date(r.t) : null;
});
