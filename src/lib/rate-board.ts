import { and, desc, eq } from "drizzle-orm";
import { getDb, products, rateAliases, rateMessages, variants } from "@/db";
import { brandColor, kindKey, parseRates, type PriceKind } from "./rate-message";

export type BoardPrice = {
  variantId: number;
  kind: PriceKind;
  price: number;
  prev: number | null;
  recent: boolean; // price changed in the last 3 days
  inStock: boolean;
};
export type BoardRow = { key: string; productId: number; name: string; label: string; image: string | null; prices: BoardPrice[] };
export type BoardBrand = { brand: string; color: string; rows: BoardRow[] };

const RECENT = 3 * 24 * 3600 * 1000;

/**
 * Today's rates for retailers, laid out like Mama's own rate list: same brand
 * order and same model order as his latest message, then any other models.
 */
export async function getRateBoard(): Promise<{ brands: BoardBrand[]; updatedAt: string | null }> {
  const db = await getDb();
  const [vs, aliases, [msg]] = await Promise.all([
    db
      .select({
        id: variants.id,
        productId: products.id,
        name: products.name,
        brand: products.brand,
        images: products.images,
        label: variants.label,
        kind: variants.kind,
        price: variants.price,
        prevPrice: variants.prevPrice,
        stock: variants.stock,
        updatedAt: variants.priceUpdatedAt,
        sort: variants.sortOrder,
      })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(eq(products.isActive, true)),
    db.select().from(rateAliases),
    db.select({ text: rateMessages.text }).from(rateMessages).where(and(eq(rateMessages.isCurrent, true))).orderBy(desc(rateMessages.id)).limit(1),
  ]);

  const byId = new Map(vs.map((v) => [v.id, v]));
  const alias = new Map(aliases.map((a) => [a.key, a.variantId]));
  const now = Date.now();
  let latest = 0;
  const price = (v: (typeof vs)[number]): BoardPrice => {
    const t = new Date(v.updatedAt).getTime();
    if (t > latest) latest = t;
    return {
      variantId: v.id,
      kind: v.kind,
      price: v.price,
      prev: v.prevPrice,
      recent: !!v.prevPrice && v.prevPrice !== v.price && now - t < RECENT,
      inStock: v.stock > 0,
    };
  };

  const used = new Set<number>();
  const brands = new Map<string, BoardRow[]>();
  const push = (brand: string, row: BoardRow) => brands.set(brand, [...(brands.get(brand) ?? []), row]);

  // 1. in the order of Mama's latest rate message
  if (msg) {
    for (const l of parseRates(msg.text).lines) {
      const found = l.prices
        .map((p) => alias.get(kindKey(l, p.kind)))
        .map((id) => (id ? byId.get(id) : undefined))
        .filter((v): v is (typeof vs)[number] => !!v && !used.has(v.id));
      if (!found.length) continue;
      for (const v of found) used.add(v.id);
      const head = found[0];
      push(head.brand || l.brand, {
        key: `m${l.n}`,
        productId: head.productId,
        name: head.name,
        label: head.label,
        image: head.images[0] ?? null,
        prices: found.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "fresh" ? -1 : 1)).map(price),
      });
    }
  }

  // 2. everything else, by brand → model → variant (fresh + activated together)
  const rest = vs
    .filter((v) => !used.has(v.id))
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name) || a.sort - b.sort);
  const restRows = new Map<string, { brand: string; row: BoardRow }>();
  for (const v of rest) {
    const k = `${v.productId}|${v.label.toLowerCase()}`;
    const r = restRows.get(k);
    if (r) r.row.prices.push(price(v));
    else restRows.set(k, { brand: v.brand || "Other", row: { key: `v${v.id}`, productId: v.productId, name: v.name, label: v.label, image: v.images[0] ?? null, prices: [price(v)] } });
  }
  for (const { brand, row } of restRows.values()) push(brand, row);

  return {
    brands: [...brands.entries()].map(([brand, rows]) => ({ brand, color: brandColor(brand), rows })),
    updatedAt: latest ? new Date(latest).toISOString() : null,
  };
}
