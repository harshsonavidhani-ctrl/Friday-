import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDb, orders, payments, users, type PaymentMethod } from "@/db";
import { orderNo } from "./format";

/**
 * Khata (ledger) for one shop.
 *  - Debit  = every order once Mama confirms it (pending / cancelled are not counted)
 *  - Credit = every payment Mama marked "Received" on those orders
 * Balance > 0 means the shop owes money (udhaar).
 */
const COUNTED = ["confirmed", "dispatched", "ready", "completed"] as const;

export type LedgerEntry = {
  date: Date;
  kind: "order" | "payment";
  orderId: number;
  ref: string;
  /** pieces on an order line */
  pcs: number;
  method: PaymentMethod | null;
  /** payment reference (UTR / cheque no.) */
  detail: string;
  debit: number;
  credit: number;
  balance: number;
};

export async function getLedger(userId: number, range: { from?: Date; to?: Date } = {}) {
  const db = await getDb();
  const [ords, pays, pending] = await Promise.all([
    db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        total: orders.total,
        status: orders.status,
        // full "orders"."id": without joins drizzle prints a bare "id" (= oi.id inside the sub-query)
        items: sql<number>`(select coalesce(sum(qty),0) from order_items oi where oi.order_id = "orders"."id")`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.userId, userId), inArray(orders.status, [...COUNTED])))
      .orderBy(asc(orders.createdAt)),
    db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        amount: payments.amount,
        method: payments.method,
        reference: payments.reference,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(orders.userId, userId), inArray(orders.status, [...COUNTED]), eq(payments.status, "verified")))
      .orderBy(asc(payments.createdAt)),
    db
      .select({ id: orders.id, createdAt: orders.createdAt, total: orders.total })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "pending")))
      .orderBy(asc(orders.createdAt)),
  ]);

  const all = [
    ...ords.map((o) => ({
      date: new Date(o.createdAt),
      kind: "order" as const,
      orderId: o.id,
      ref: orderNo(o.id),
      pcs: o.items,
      method: null,
      detail: "",
      debit: o.total,
      credit: 0,
    })),
    ...pays.map((p) => ({
      date: new Date(p.createdAt),
      kind: "payment" as const,
      orderId: p.orderId,
      ref: orderNo(p.orderId),
      pcs: 0,
      method: p.method,
      detail: p.reference,
      debit: 0,
      credit: p.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === "order" ? -1 : 1));

  const from = range.from?.getTime() ?? -Infinity;
  const to = range.to?.getTime() ?? Infinity;
  let opening = 0;
  let running = 0;
  const entries: LedgerEntry[] = [];
  for (const e of all) {
    running += e.debit - e.credit;
    const t = e.date.getTime();
    if (t < from) opening = running;
    else if (t <= to) entries.push({ ...e, balance: running });
  }
  const debit = entries.reduce((s, e) => s + e.debit, 0);
  const credit = entries.reduce((s, e) => s + e.credit, 0);
  const balance = all.reduce((s, e) => s + e.debit - e.credit, 0);
  return { entries, opening, closing: opening + debit - credit, debit, credit, balance, pending };
}

/** Orders that still have money due, oldest first (for reminders and lump-sum payments). */
export async function getDueOrders(userId: number) {
  const db = await getDb();
  const rows = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      total: orders.total,
      paid: sql<number>`(select coalesce(sum(amount),0) from payments p where p.order_id = "orders"."id" and p.status = 'verified')`.mapWith(Number),
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), notInArray(orders.status, ["pending", "cancelled"])))
    .orderBy(asc(orders.createdAt), asc(orders.id));
  return rows.map((r) => ({ ...r, due: r.total - r.paid })).filter((r) => r.due > 0);
}

export async function getRetailer(userId: number) {
  const db = await getDb();
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      shopName: users.shopName,
      phone: users.phone,
      gstin: users.gstin,
      city: users.city,
      address: users.address,
      status: users.status,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}

/** Date range from ?range= (this month, last 3 months, this financial year, all). */
export function rangeFromParam(range?: string, fromS?: string, toS?: string) {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const startOfDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - 5.5 * 3600 * 1000);
  if (fromS || toS) {
    const f = fromS ? new Date(`${fromS}T00:00:00+05:30`) : undefined;
    const t = toS ? new Date(`${toS}T23:59:59.999+05:30`) : undefined;
    return { key: "custom", from: f && !isNaN(+f) ? f : undefined, to: t && !isNaN(+t) ? t : undefined };
  }
  if (range === "month") return { key: "month", from: startOfDay(ist.getFullYear(), ist.getMonth(), 1), to: undefined };
  if (range === "3m") return { key: "3m", from: startOfDay(ist.getFullYear(), ist.getMonth() - 2, 1), to: undefined };
  if (range === "fy") {
    const fyStart = ist.getMonth() >= 3 ? ist.getFullYear() : ist.getFullYear() - 1;
    return { key: "fy", from: startOfDay(fyStart, 3, 1), to: undefined };
  }
  return { key: "all", from: undefined, to: undefined };
}
