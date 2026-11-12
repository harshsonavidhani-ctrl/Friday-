import { asc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { cartItems, getDb, products, variants } from "@/db";
import { getSettings } from "./settings";

export async function getMaxQty(): Promise<number> {
  return Number((await getSettings()).maxQtyPerItem) || 50;
}

export const getCart = cache(async (userId: number) => {
  const db = await getDb();
  const maxQty = await getMaxQty();
  const rows = await db
    .select({
      variantId: cartItems.variantId,
      qty: cartItems.qty,
      label: variants.label,
      kind: variants.kind,
      modelNumber: variants.modelNumber,
      price: variants.price,
      mrp: variants.mrp,
      stock: variants.stock,
      productId: products.id,
      name: products.name,
      brand: products.brand,
      images: products.images,
      moq: products.moq,
      isActive: products.isActive,
    })
    .from(cartItems)
    .innerJoin(variants, eq(variants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(products.name), asc(variants.sortOrder));
  // problem = English text key + values (translated where it is shown)
  type Problem = { text: string; vars?: Record<string, number> } | null;
  return rows.map((r) => ({
    ...r,
    image: r.images[0] ?? null,
    problem: (!r.isActive
      ? { text: "No longer available" }
      : r.stock <= 0
        ? { text: "Out of stock" }
        : r.qty > r.stock
          ? { text: "Only {n} left", vars: { n: r.stock } }
          : r.qty > maxQty
            ? { text: "Maximum {n} pcs per item", vars: { n: maxQty } }
            : r.qty < r.moq
              ? { text: "Minimum {n} pcs", vars: { n: r.moq } }
              : null) as Problem,
  }));
});

export type CartLine = Awaited<ReturnType<typeof getCart>>[number];

export const getCartCount = cache(async (userId: number) => {
  const db = await getDb();
  const [r] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(cartItems)
    .where(eq(cartItems.userId, userId));
  return r?.n ?? 0;
});
