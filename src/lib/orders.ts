import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb, orderItems, orders, orderSerials, payments, users, variants, type DB } from "@/db";
import { paymentSummary } from "./constants";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export async function getOrderDetails(orderId: number) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const [items, pays, serials, [customer]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id)),
    db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(asc(payments.id)),
    db
      .select({ id: orderSerials.id, orderItemId: orderSerials.orderItemId, serial: orderSerials.serial })
      .from(orderSerials)
      .where(eq(orderSerials.orderId, orderId))
      .orderBy(asc(orderSerials.id)),
    db
      .select({
        id: users.id,
        name: users.name,
        shopName: users.shopName,
        phone: users.phone,
        gstin: users.gstin,
        address: users.address,
        city: users.city,
      })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1),
  ]);
  const serialsByItem = new Map<number, { id: number; serial: string }[]>();
  for (const s of serials) serialsByItem.set(s.orderItemId, [...(serialsByItem.get(s.orderItemId) ?? []), { id: s.id, serial: s.serial }]);
  return {
    order,
    items: items.map((i) => ({ ...i, serials: serialsByItem.get(i.id) ?? [] })),
    payments: pays,
    customer,
    pay: paymentSummary(order.total, pays),
  };
}

export type OrderDetails = NonNullable<Awaited<ReturnType<typeof getOrderDetails>>>;

/** Orders with item counts and payment state, for list pages. */
export async function listOrders(opts: { userId?: number; statuses?: string[]; limit?: number; q?: string }) {
  const db = await getDb();
  const conds: (SQL | undefined)[] = [];
  if (opts.userId) conds.push(eq(orders.userId, opts.userId));
  if (opts.statuses?.length) conds.push(inArray(orders.status, opts.statuses as never[]));
  const q = opts.q?.trim().slice(0, 60);
  if (q) {
    // order no. "LA-1005" / "1005", shop, owner, phone or an IMEI on the order
    const numS = q.replace(/^LA-?/i, "");
    const num = /^\d{4,8}$/.test(numS) ? Number(numS) : NaN; // order numbers only (IMEIs are longer)
    const like = `%${q.replace(/[%_\\]/g, "")}%`;
    const serialQ = q.toUpperCase().replace(/[\s-]/g, "");
    conds.push(
      or(
        Number.isInteger(num) && num > 1000 ? eq(orders.id, num - 1000) : undefined,
        ilike(users.shopName, like),
        ilike(users.name, like),
        ilike(users.phone, like),
        serialQ.length >= 4
          ? sql`exists (select 1 from order_serials s where s.order_id = ${orders.id} and s.serial like ${`%${serialQ.replace(/[%_\\]/g, "")}%`})`
          : undefined,
      ),
    );
  }
  const rows = await db
    .select({
      order: orders,
      shopName: users.shopName,
      customerName: users.name,
      phone: users.phone,
      itemCount: sql<number>`(select coalesce(sum(qty),0) from order_items oi where oi.order_id = ${orders.id})`.mapWith(Number),
      verified: sql<number>`(select coalesce(sum(amount),0) from payments p where p.order_id = ${orders.id} and p.status = 'verified')`.mapWith(Number),
      submitted: sql<number>`(select coalesce(sum(amount),0) from payments p where p.order_id = ${orders.id} and p.status = 'submitted')`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(opts.limit ?? 100);
  return rows.map((r) => ({
    ...r,
    pay: paymentSummary(r.order.total, [
      { amount: r.verified, status: "verified" },
      { amount: r.submitted, status: "submitted" },
    ]),
  }));
}

/** Recalculate subtotal/total from items + charges. */
export async function recomputeTotals(tx: Tx, orderId: number) {
  const [{ subtotal }] = await tx
    .select({ subtotal: sql<number>`coalesce(sum(${orderItems.price} * ${orderItems.qty}), 0)`.mapWith(Number) })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const [o] = await tx
    .select({ parcelCharge: orders.parcelCharge, discount: orders.discount })
    .from(orders)
    .where(eq(orders.id, orderId));
  const total = Math.max(0, subtotal + o.parcelCharge - o.discount);
  await tx.update(orders).set({ subtotal, total, updatedAt: new Date() }).where(eq(orders.id, orderId));
  return { subtotal, total };
}

/** Put stock back for all items of an order (used on cancel). */
export async function restoreStock(tx: Tx, orderId: number) {
  const items = await tx
    .select({ variantId: orderItems.variantId, qty: orderItems.qty })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    if (!it.variantId) continue;
    await tx
      .update(variants)
      .set({ stock: sql`${variants.stock} + ${it.qty}` })
      .where(eq(variants.id, it.variantId));
  }
}

/** Take stock; throws if not enough pieces. */
export async function takeStock(tx: Tx, variantId: number, qty: number, name: string) {
  if (qty === 0) return;
  if (qty < 0) {
    await tx.update(variants).set({ stock: sql`${variants.stock} + ${-qty}` }).where(eq(variants.id, variantId));
    return;
  }
  const done = await tx
    .update(variants)
    .set({ stock: sql`${variants.stock} - ${qty}` })
    .where(and(eq(variants.id, variantId), sql`${variants.stock} >= ${qty}`))
    .returning({ id: variants.id });
  if (!done.length) throw new StockError(`Not enough stock for ${name}`);
}

export class StockError extends Error {}
