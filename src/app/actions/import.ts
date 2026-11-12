"use server";

import { revalidatePath } from "next/cache";
import { categories, getDb, products, variants } from "@/db";
import { getAdminOrNull } from "@/lib/auth";
import { detectBrand, detectCategoryKey, findCategoryId, parseVariant } from "@/lib/detect";
import { readSheet } from "@/lib/sheet";

export async function readImportFile(form: FormData): Promise<{ rows: string[][]; sheet: string } | { error: string }> {
  if (!(await getAdminOrNull())) return { error: "Please login as admin" };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first" };
  if (file.size > 8 * 1024 * 1024) return { error: "File is too big (max 8 MB)" };
  return readSheet(file);
}

export type NewModelRow = { name: string; label: string; modelNumber: string; price: number; mrp: number | null; stock: number };

/** "Add as new model" for rows that are not in the catalog yet (photos can be added later). */
export async function importNewProducts(rows: NewModelRow[]): Promise<{ ok: true; products: number; variants: number } | { error: string }> {
  if (!(await getAdminOrNull())) return { error: "Please login as admin" };
  const list = rows
    .slice(0, 1000)
    .map((r) => ({
      name: String(r.name ?? "").trim().slice(0, 150),
      label: String(r.label ?? "").trim().slice(0, 80),
      modelNumber: String(r.modelNumber ?? "").trim().slice(0, 80),
      price: Math.max(0, Math.round(Number(r.price) || 0)),
      mrp: r.mrp ? Math.max(0, Math.round(Number(r.mrp))) : null,
      stock: Math.max(0, Math.round(Number(r.stock) || 0)),
    }))
    .filter((r) => r.name.length >= 2 && r.price > 0);
  if (!list.length) return { error: "Nothing to add — new models need a name and a price" };

  // "S24 Ultra 12/256" + "S24 Ultra 12/512" → one product with two variants
  const groups = new Map<string, { name: string; vars: typeof list }>();
  for (const r of list) {
    let base = r.name;
    let label = r.label;
    if (!label) {
      const pv = parseVariant(r.name);
      if (pv) {
        label = pv.label;
        base = pv.rest;
      }
    }
    const key = base.toLowerCase().replace(/\s+/g, " ");
    const g = groups.get(key) ?? { name: base, vars: [] };
    if (!g.vars.some((v) => v.label.toLowerCase() === label.toLowerCase())) g.vars.push({ ...r, label });
    groups.set(key, g);
  }

  const db = await getDb();
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories);
  let nVariants = 0;
  await db.transaction(async (tx) => {
    for (const g of groups.values()) {
      const brand = detectBrand(g.name);
      const [p] = await tx
        .insert(products)
        .values({
          name: g.name,
          brand,
          categoryId: findCategoryId(detectCategoryKey(g.name, brand), cats),
          isActive: true,
        })
        .returning({ id: products.id });
      await tx.insert(variants).values(
        g.vars.map((v, i) => ({
          productId: p.id,
          label: v.label,
          modelNumber: v.modelNumber,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
          sortOrder: i,
        })),
      );
      nVariants += g.vars.length;
    }
  });
  revalidatePath("/", "layout");
  return { ok: true, products: groups.size, variants: nVariants };
}
