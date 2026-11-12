"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, rateAliases, rateMessages, variants } from "@/db";
import { getAdminOrNull } from "@/lib/auth";
import { createModelsFromRows, IN_STOCK, type NewModelLine } from "@/lib/rate-import";

type R<T = object> = ({ ok: true } & T) | { ok?: false; error: string };
const NOT_ADMIN = { error: "Please login as admin" } as const;
const done = () => revalidatePath("/", "layout");

/** Step 1: save the Old message (the one today's changes start from). */
export async function saveOldMessage(text: string): Promise<R<{ id: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const t = String(text ?? "").slice(0, 200_000);
  if (t.trim().length < 5) return { error: "Paste the rate message first" };
  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    await tx.update(rateMessages).set({ isCurrent: false }).where(eq(rateMessages.isCurrent, true));
    const [m] = await tx.insert(rateMessages).values({ kind: "old", text: t, isCurrent: true }).returning({ id: rateMessages.id });
    return m.id;
  });
  done();
  return { ok: true, id };
}

export async function deleteRateMessage(id: number): Promise<R> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  await db.delete(rateMessages).where(eq(rateMessages.id, id));
  done();
  return { ok: true };
}

/** Use an older saved message as the Old message again. */
export async function pickRateMessage(id: number): Promise<R> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(rateMessages).set({ isCurrent: false }).where(ne(rateMessages.id, id));
    await tx.update(rateMessages).set({ isCurrent: true }).where(eq(rateMessages.id, id));
  });
  done();
  return { ok: true };
}

export type { NewModelLine } from "@/lib/rate-import";

/** First time: every line of the message becomes a model in the app (photos can follow). */
export async function addModelsFromMessage(
  list: NewModelLine[],
  opts: { onlyInStock?: boolean } = {},
): Promise<R<{ products: number; variants: number; links: Record<string, number> }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const r = await createModelsFromRows(list, opts);
  if (!r.products && !r.variants) return { error: "Nothing to add" };
  done();
  return { ok: true, ...r };
}
/** "This line = that model" (or forget it with variantId = null). */
export async function linkRateLine(aliasKey: string, variantId: number | null): Promise<R> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const key = String(aliasKey).slice(0, 300);
  const db = await getDb();
  if (variantId === null) await db.delete(rateAliases).where(eq(rateAliases.key, key));
  else
    await db
      .insert(rateAliases)
      .values({ key, variantId })
      .onConflictDoUpdate({ target: rateAliases.key, set: { variantId } });
  done();
  return { ok: true };
}

export async function clearRateAliases(): Promise<R<{ removed: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  const r = await db.delete(rateAliases).returning({ key: rateAliases.key });
  done();
  return { ok: true, removed: r.length };
}

/** Step 3: keep the New message (not yet shown to retailers). */
export async function saveNewMessage(text: string, changes: number): Promise<R<{ id: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const t = String(text ?? "").slice(0, 200_000);
  if (!t.trim()) return { error: "Nothing to save" };
  const db = await getDb();
  const [m] = await db
    .insert(rateMessages)
    .values({ kind: "new", text: t, changes: Math.max(0, Math.round(changes) || 0) })
    .returning({ id: rateMessages.id });
  done();
  return { ok: true, id: m.id };
}

export type RateApply = {
  messageId: number;
  prices: { variantId: number; price: number }[];
  notAvailable: number[];
  available: number[];
};

/**
 * Step 4: "Update retailers' prices" — the shop shows the new rates at once,
 * and this New message becomes tomorrow's Old message.
 */
export async function applyRates(input: RateApply): Promise<R<{ prices: number; notAvailable: number; available: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const prices = input.prices.slice(0, 5000).filter((p) => Number.isInteger(p.variantId) && Number(p.price) > 0);
  const na = [...new Set(input.notAvailable.filter(Number.isInteger))].slice(0, 5000);
  const back = [...new Set(input.available.filter(Number.isInteger))].filter((id) => !na.includes(id)).slice(0, 5000);
  const db = await getDb();
  let changed = 0;
  let restored = 0;
  let marked = 0;
  await db.transaction(async (tx) => {
    const ids = [...new Set([...prices.map((p) => p.variantId), ...na, ...back])];
    const old = ids.length
      ? await tx.select({ id: variants.id, price: variants.price, stock: variants.stock }).from(variants).where(inArray(variants.id, ids))
      : [];
    const byId = new Map(old.map((v) => [v.id, v]));
    for (const p of prices) {
      const v = byId.get(p.variantId);
      const price = Math.round(p.price);
      if (!v || v.price === price) continue;
      await tx.update(variants).set({ price, prevPrice: v.price, priceUpdatedAt: new Date() }).where(eq(variants.id, v.id));
      changed++;
    }
    if (na.length) {
      const r = await tx.update(variants).set({ stock: 0 }).where(and(inArray(variants.id, na), sql`${variants.stock} > 0`)).returning({ id: variants.id });
      marked = r.length;
    }
    if (back.length) {
      const r = await tx
        .update(variants)
        .set({ stock: IN_STOCK })
        .where(and(inArray(variants.id, back), sql`${variants.stock} <= 0`))
        .returning({ id: variants.id });
      restored = r.length;
    }
    if (input.messageId) {
      await tx.update(rateMessages).set({ isCurrent: false }).where(ne(rateMessages.id, input.messageId));
      await tx.update(rateMessages).set({ isCurrent: true, applied: true, changes: changed }).where(eq(rateMessages.id, input.messageId));
    }
  });
  done();
  return { ok: true, prices: changed, notAvailable: marked, available: restored };
}
