import { eq } from "drizzle-orm";
import { categories, getDb, products, rateAliases, rateMessages, settings, variants } from "@/db";
import { detectCategoryKey, findCategoryId } from "./detect";
import { catalogKey, kindKey, lineCatalogKey, parseRates, productKey, variantLabel } from "./rate-message";

export const IN_STOCK = 100; // "available" when Mama does not count pieces

export type NewModelLine = {
  aliasKey: string; // line key + #fresh / #activated
  productKey: string;
  brand: string;
  name: string;
  label: string;
  kind: "fresh" | "activated";
  price: number;
};

/** Creates products + variants for message lines and remembers which line is which model. */
export async function createModelsFromRows(list: NewModelLine[], opts: { onlyInStock?: boolean } = {}) {
  const rows = list
    .slice(0, 3000)
    .map((r) => ({
      aliasKey: String(r.aliasKey).slice(0, 300),
      productKey: String(r.productKey).slice(0, 200),
      brand: String(r.brand ?? "").trim().slice(0, 60),
      name: String(r.name ?? "").trim().slice(0, 150),
      label: String(r.label ?? "").trim().slice(0, 80),
      kind: r.kind === "activated" ? ("activated" as const) : ("fresh" as const),
      price: Math.max(0, Math.round(Number(r.price) || 0)),
    }))
    .filter((r) => r.name.length >= 2 && r.price > 0 && r.aliasKey);
  const links: Record<string, number> = {};
  let nProducts = 0;
  let nVariants = 0;
  if (!rows.length) return { products: 0, variants: 0, links };

  const db = await getDb();
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories);
  await db.transaction(async (tx) => {
    const groups = new Map<string, typeof rows>();
    for (const r of rows) groups.set(r.productKey, [...(groups.get(r.productKey) ?? []), r]);
    for (const g of groups.values()) {
      const head = g[0];
      const [p] = await tx
        .insert(products)
        .values({ name: head.name, brand: head.brand, categoryId: findCategoryId(detectCategoryKey(head.name, head.brand) ?? "mobile", cats), isActive: true })
        .returning({ id: products.id });
      nProducts++;
      const seen = new Map<string, number>();
      let order = 0;
      for (const r of g) {
        const vk = `${r.label.toLowerCase()}#${r.kind}`;
        let vid = seen.get(vk);
        if (!vid) {
          const [v] = await tx
            .insert(variants)
            .values({ productId: p.id, label: r.label, kind: r.kind, price: r.price, stock: IN_STOCK, sortOrder: order++ })
            .returning({ id: variants.id });
          vid = v.id;
          seen.set(vk, vid);
          nVariants++;
        }
        links[r.aliasKey] = vid;
        await tx
          .insert(rateAliases)
          .values({ key: r.aliasKey, variantId: vid })
          .onConflictDoUpdate({ target: rateAliases.key, set: { variantId: vid } });
      }
    }
    if (opts.onlyInStock) {
      await tx
        .insert(settings)
        .values({ key: "showStockQty", value: "0" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "0" } });
    }
  });
  return { products: nProducts, variants: nVariants, links };
}

/**
 * Whole message at once (used by `npm run rates:import`): saves it as the Old
 * message and adds every phone that is not in the app yet.
 */
export async function importRateMessage(text: string) {
  const db = await getDb();
  const parsed = parseRates(text);
  const [cat, aliases] = await Promise.all([
    db
      .select({ id: variants.id, label: variants.label, kind: variants.kind, name: products.name, brand: products.brand })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId)),
    db.select().from(rateAliases),
  ]);
  const exact = new Map(cat.map((c) => [catalogKey(c.brand, c.name, c.label, c.kind), c.id]));
  const known = new Set(aliases.map((a) => a.key));
  const rows: NewModelLine[] = [];
  let already = 0;
  for (const l of parsed.lines) {
    for (const p of l.prices) {
      const ak = kindKey(l, p.kind);
      const hit = exact.get(lineCatalogKey(l, p.kind));
      if (known.has(ak)) already++;
      else if (hit) {
        await db.insert(rateAliases).values({ key: ak, variantId: hit }).onConflictDoNothing();
        already++;
      } else {
        rows.push({ aliasKey: ak, productKey: productKey(l.brandKey, l.name), brand: l.brand, name: l.name, label: variantLabel(l), kind: p.kind, price: p.value });
      }
    }
  }
  const made = await createModelsFromRows(rows, { onlyInStock: true });
  await db.update(rateMessages).set({ isCurrent: false }).where(eq(rateMessages.isCurrent, true));
  await db.insert(rateMessages).values({ kind: "old", text, isCurrent: true });
  return { lines: parsed.lines.length, brands: parsed.brands.length, already, ...made, duplicates: parsed.duplicates };
}
