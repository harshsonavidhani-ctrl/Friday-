"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  categories,
  getDb,
  orderItems,
  orders,
  orderSerials,
  payments,
  products,
  sessions,
  users,
  variants,
  PAYMENT_METHODS,
  ORDER_STATUSES,
  type OrderStatus,
  type PaymentMethod,
  type Spec,
} from "@/db";
import { DEMO_ADMIN_PHONE, DEMO_PRODUCT_NAMES, DEMO_RETAILER_PHONE } from "@/db/seed";
import { createLoginToken, getAdminOrNull } from "@/lib/auth";
import { formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getDueOrders } from "@/lib/khata";
import { notify } from "@/lib/notify";
import { siteUrl } from "@/lib/site-url";
import { recomputeTotals, restoreStock, StockError, takeStock } from "@/lib/orders";
import { cleanSerial } from "@/lib/serials";
import { hashPassword, tempPassword } from "@/lib/password";
import { searchProductImages } from "@/lib/image-search";
import { getSettings, saveSettings, SETTING_KEYS, type Settings } from "@/lib/settings";
import { importImageFromUrl } from "@/lib/storage";
import { isValidUpiId } from "@/lib/upi";
import { GSTIN_RE, normalizePhone, rupees, str, type FormState } from "@/lib/validate";

export type Result<T = object> = ({ ok: true } & T) | { ok?: false; error: string };

const NOT_ADMIN = { error: "Please login as admin" } as const;

function done() {
  revalidatePath("/", "layout");
}

// ───────────────────────── Products ─────────────────────────

export type VariantInput = {
  id?: number;
  label: string;
  kind?: "fresh" | "activated";
  modelNumber: string;
  price: number;
  mrp: number | null;
  stock: number;
};

export type ProductInput = {
  id?: number;
  name: string;
  brand: string;
  categoryId: number | null;
  description: string;
  specs: Spec[];
  images: string[];
  moq: number;
  isActive: boolean;
  variants: VariantInput[];
};

const int = (n: unknown, min = 0) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(min, v) : min;
};

export async function saveProduct(input: ProductInput): Promise<Result<{ id: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const name = input.name.trim().slice(0, 150);
  if (name.length < 2) return { error: "Enter the model name" };
  const vs = input.variants
    .map((v) => ({
      id: v.id,
      label: v.label.trim().slice(0, 80),
      kind: v.kind === "activated" ? ("activated" as const) : ("fresh" as const),
      modelNumber: v.modelNumber.trim().slice(0, 80),
      price: int(v.price),
      mrp: v.mrp ? int(v.mrp) : null,
      stock: int(v.stock),
    }))
    .slice(0, 30);
  if (!vs.length) return { error: "Add at least one price" };
  if (vs.some((v) => v.price <= 0)) return { error: "Every variant needs a price" };
  const labels = vs.map((v) => `${v.label.toLowerCase()}#${v.kind}`);
  if (new Set(labels).size !== labels.length) return { error: "Two variants have the same name" };

  const images = input.images
    .filter((u) => typeof u === "string" && (u.startsWith("/uploads/") || u.startsWith("https://")))
    .slice(0, 8);
  const specs = input.specs
    .map((s) => ({ label: s.label.trim().slice(0, 60), value: s.value.trim().slice(0, 300) }))
    .filter((s) => s.label && s.value)
    .slice(0, 40);

  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    const values = {
      name,
      brand: input.brand.trim().slice(0, 60),
      categoryId: input.categoryId || null,
      description: input.description.trim().slice(0, 5000),
      specs,
      images,
      moq: int(input.moq, 1),
      isActive: input.isActive,
      updatedAt: new Date(),
    };
    let productId: number;
    if (input.id) {
      const [p] = await tx.update(products).set(values).where(eq(products.id, input.id)).returning({ id: products.id });
      if (!p) throw new Error("Product not found");
      productId = p.id;
    } else {
      const [p] = await tx.insert(products).values(values).returning({ id: products.id });
      productId = p.id;
    }

    const old = await tx.select().from(variants).where(eq(variants.productId, productId));
    const oldById = new Map(old.map((v) => [v.id, v]));
    const keepIds = vs.map((v) => v.id).filter((x): x is number => !!x && oldById.has(x));
    if (old.length) {
      await tx
        .delete(variants)
        .where(
          keepIds.length
            ? and(eq(variants.productId, productId), notInArray(variants.id, keepIds))
            : eq(variants.productId, productId),
        );
    }
    for (const [i, v] of vs.entries()) {
      const prev = v.id ? oldById.get(v.id) : undefined;
      if (prev) {
        const priceChanged = prev.price !== v.price;
        await tx
          .update(variants)
          .set({
            label: v.label,
            kind: v.kind,
            modelNumber: v.modelNumber,
            price: v.price,
            mrp: v.mrp,
            stock: v.stock,
            sortOrder: i,
            ...(priceChanged ? { prevPrice: prev.price, priceUpdatedAt: new Date() } : {}),
          })
          .where(eq(variants.id, prev.id));
      } else {
        await tx.insert(variants).values({ productId, ...v, id: undefined, sortOrder: i });
      }
    }
    return productId;
  });
  done();
  return { ok: true, id };
}

export async function duplicateProduct(id: number): Promise<Result<{ id: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  const newId = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, id));
    if (!p) return null;
    const [copy] = await tx
      .insert(products)
      .values({ ...p, id: undefined, name: `${p.name} (copy)`, isActive: false, createdAt: new Date(), updatedAt: new Date() })
      .returning({ id: products.id });
    const vs = await tx.select().from(variants).where(eq(variants.productId, id));
    if (vs.length) {
      await tx.insert(variants).values(
        vs.map((v) => ({ ...v, id: undefined, productId: copy.id, stock: 0, prevPrice: null, priceUpdatedAt: new Date() })),
      );
    }
    return copy.id;
  });
  if (!newId) return { error: "Product not found" };
  done();
  return { ok: true, id: newId };
}

export async function setProductActive(id: number, isActive: boolean): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  await db.update(products).set({ isActive, updatedAt: new Date() }).where(eq(products.id, id));
  done();
  return { ok: true };
}

export async function deleteProduct(id: number): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  await db.delete(products).where(eq(products.id, id));
  done();
  return { ok: true };
}

/** Finds and saves a photo for a product that has none (bulk "Auto-add photos"). */
export async function adminAutoPhoto(productId: number): Promise<Result<{ image: string | null }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  const [p] = await db.select({ name: products.name, brand: products.brand, images: products.images }).from(products).where(eq(products.id, productId));
  if (!p) return { error: "Product not found" };
  if (p.images.length) return { ok: true, image: p.images[0] };
  const s = await getSettings();
  const keys = { brave: process.env.BRAVE_API_KEY || s.braveApiKey, serper: process.env.SERPER_API_KEY || s.serperApiKey };
  const q = p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name;
  const found = await searchProductImages(q, keys);
  if (found.error === "not-configured") return { error: "Turn on photo search in Settings first" };
  for (const r of found.results.slice(0, 4)) {
    try {
      const url = await importImageFromUrl(r.full);
      await db.update(products).set({ images: [url], updatedAt: new Date() }).where(eq(products.id, productId));
      done();
      return { ok: true, image: url };
    } catch {
      // try the next result
    }
  }
  return { ok: true, image: null };
}

export type VariantChange = { id: number; price?: number; stock?: number; mrp?: number | null };

/** The daily "Prices & Stock" screen saves all changed rows at once. */
export async function bulkUpdateVariants(changes: VariantChange[]): Promise<Result<{ count: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const list = changes.slice(0, 2000);
  if (!list.length) return { ok: true, count: 0 };
  if (list.some((c) => c.price !== undefined && !(Number(c.price) > 0))) {
    return { error: "Price cannot be empty or zero" };
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ids = list.map((c) => c.id);
    const old = await tx.select({ id: variants.id, price: variants.price }).from(variants).where(inArray(variants.id, ids));
    const oldPrice = new Map(old.map((v) => [v.id, v.price]));
    for (const c of list) {
      if (!oldPrice.has(c.id)) continue;
      const set: Partial<typeof variants.$inferInsert> = {};
      if (c.price !== undefined) {
        const p = int(c.price, 1);
        if (p !== oldPrice.get(c.id)) {
          set.price = p;
          set.prevPrice = oldPrice.get(c.id)!;
          set.priceUpdatedAt = new Date();
        }
      }
      if (c.stock !== undefined) set.stock = int(c.stock);
      if (c.mrp !== undefined) set.mrp = c.mrp ? int(c.mrp) : null;
      if (Object.keys(set).length) await tx.update(variants).set(set).where(eq(variants.id, c.id));
    }
  });
  done();
  return { ok: true, count: list.length };
}

// ───────────────────────── Categories ─────────────────────────

export async function saveCategory(_: FormState, form: FormData): Promise<FormState> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const id = Number(form.get("id")) || null;
  const name = str(form, "name").slice(0, 60);
  const icon = str(form, "icon") || "package";
  const sortOrder = int(form.get("sortOrder"));
  if (name.length < 2) return { error: "Enter a category name" };
  const db = await getDb();
  if (id) await db.update(categories).set({ name, icon, sortOrder }).where(eq(categories.id, id));
  else await db.insert(categories).values({ name, icon, sortOrder });
  done();
  return { ok: id ? "Category saved" : "Category added" };
}

export async function deleteCategory(id: number): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  await db.delete(categories).where(eq(categories.id, id));
  done();
  return { ok: true };
}

// ───────────────────────── Orders ─────────────────────────

export async function adminSetOrderStatus(
  orderId: number,
  status: OrderStatus,
  transportInfo?: string,
): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  if (!ORDER_STATUSES.includes(status)) return { error: "Unknown status" };
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const [o] = await tx
      .select({ status: orders.status, userId: orders.userId, total: orders.total, transportInfo: orders.transportInfo })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!o) return { error: "Order not found" };
    if (o.status === "cancelled") return { error: "This order is cancelled and cannot be changed" };
    if (status === "cancelled") await restoreStock(tx, orderId);
    const info = transportInfo !== undefined ? transportInfo.trim().slice(0, 300) : o.transportInfo;
    await tx.update(orders).set({ status, updatedAt: new Date(), transportInfo: info }).where(eq(orders.id, orderId));
    return { order: { ...o, transportInfo: info, changed: o.status !== status } };
  });
  if (!res.order) return { error: res.error ?? "Order not found" };
  const o = res.order;
  if (o.changed && status !== "pending") {
    const no = orderNo(orderId);
    await notify([o.userId], (t) => {
      const map: Record<Exclude<OrderStatus, "pending">, { title: string; body: string }> = {
        confirmed: { title: t("Order {no} confirmed ✓", { no }), body: t("Total {amount}. You can pay from the order page.", { amount: formatINR(o.total) }) },
        dispatched: {
          title: t("Order {no} dispatched 🚚", { no }),
          body: o.transportInfo ? t("Transport: {info}", { info: o.transportInfo }) : t("Your parcel is on the way."),
        },
        ready: { title: t("Order {no} is ready for pickup", { no }), body: t("Please collect it from the shop.") },
        completed: { title: t("Order {no} completed — thank you!", { no }), body: "" },
        cancelled: { title: t("Order {no} was cancelled", { no }), body: t("Please call the shop for details.") },
      };
      return { kind: "order", ...map[status as Exclude<OrderStatus, "pending">], url: `/orders/${orderId}` };
    });
  }
  done();
  return { ok: true };
}

export type OrderEdit = {
  items: { id: number; qty: number; price: number }[];
  parcelCharge: number;
  discount: number;
  transportInfo: string;
};

/** Change quantities / prices / charges. Stock is adjusted by the difference. */
export async function adminUpdateOrder(orderId: number, edit: OrderEdit): Promise<Result<{ total: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  let before: { total: number; userId: number; status: OrderStatus } | null = null;
  try {
    const total = await db.transaction(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!o) throw new StockError("Order not found");
      before = { total: o.total, userId: o.userId, status: o.status };
      if (o.status === "cancelled" || o.status === "completed") {
        throw new StockError("Completed or cancelled orders cannot be edited");
      }
      const current = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const byId = new Map(current.map((i) => [i.id, i]));
      for (const e of edit.items) {
        const it = byId.get(e.id);
        if (!it) continue;
        const qty = int(e.qty);
        const price = int(e.price);
        if (it.variantId && qty !== it.qty) {
          await takeStock(tx, it.variantId, qty - it.qty, `${it.name} ${it.variantLabel}`.trim());
        }
        if (qty === 0) await tx.delete(orderItems).where(eq(orderItems.id, it.id));
        else await tx.update(orderItems).set({ qty, price }).where(eq(orderItems.id, it.id));
      }
      await tx
        .update(orders)
        .set({
          parcelCharge: int(edit.parcelCharge),
          discount: int(edit.discount),
          transportInfo: edit.transportInfo.trim().slice(0, 300),
        })
        .where(eq(orders.id, orderId));
      return (await recomputeTotals(tx, orderId)).total;
    });
    const b = before as { total: number; userId: number; status: OrderStatus } | null;
    if (b && b.total !== total && b.status !== "pending") {
      await notify([b.userId], (t) => ({
        kind: "order",
        title: t("Order {no} updated — new total {amount}", { no: orderNo(orderId), amount: formatINR(total) }),
        body: t("Was {amount}. Open the order to see the changes.", { amount: formatINR(b.total) }),
        url: `/orders/${orderId}`,
      }));
    }
    done();
    return { ok: true, total };
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
}

export async function adminRecordPayment(
  orderId: number,
  amount: number,
  method: PaymentMethod,
  reference: string,
): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const amt = int(amount);
  if (amt < 1) return { error: "Enter the amount received" };
  if (!PAYMENT_METHODS.includes(method)) return { error: "Choose how it was paid" };
  const db = await getDb();
  const [o] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, orderId));
  if (!o) return { error: "Order not found" };
  await db.insert(payments).values({
    orderId,
    amount: amt,
    method,
    reference: reference.trim().slice(0, 60),
    status: "verified",
    byAdmin: true,
  });
  await notify([o.userId], (t) => ({
    kind: "payment",
    title: t("Payment {amount} received ✓", { amount: formatINR(amt) }),
    body: t("Order {no}. Thank you!", { no: orderNo(orderId) }),
    url: `/orders/${orderId}`,
  }));
  done();
  return { ok: true };
}

/**
 * Undo a mistake. A payment the retailer sent goes back to "Verifying"
 * (so Mama can tap Received / Not received again); a payment Mama
 * entered himself is removed.
 */
export async function adminUndoPayment(paymentId: number): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  const [p] = await db.select({ byAdmin: payments.byAdmin }).from(payments).where(eq(payments.id, paymentId));
  if (!p) return { error: "Payment not found" };
  if (p.byAdmin) await db.delete(payments).where(eq(payments.id, paymentId));
  else await db.update(payments).set({ status: "submitted" }).where(eq(payments.id, paymentId));
  done();
  return { ok: true };
}

export async function adminSetPaymentStatus(paymentId: number, status: "verified" | "rejected"): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  if (status !== "verified" && status !== "rejected") return { error: "Unknown status" };
  const db = await getDb();
  const [p] = await db
    .update(payments)
    .set({ status })
    .where(eq(payments.id, paymentId))
    .returning({ orderId: payments.orderId, amount: payments.amount, reference: payments.reference });
  if (p) {
    const [o] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, p.orderId));
    if (o) {
      await notify([o.userId], (t) =>
        status === "verified"
          ? {
              kind: "payment",
              title: t("Payment {amount} received ✓", { amount: formatINR(p.amount) }),
              body: t("Order {no}. Thank you!", { no: orderNo(p.orderId) }),
              url: `/orders/${p.orderId}`,
            }
          : {
              kind: "payment",
              title: t("Payment {amount} not received", { amount: formatINR(p.amount) }),
              body: t("Reference {ref} could not be found. Please check and send again, or call the shop.", { ref: p.reference || "—" }),
              url: `/orders/${p.orderId}`,
            },
      );
    }
  }
  done();
  return { ok: true };
}

// ───────────────────────── IMEI / serial numbers ─────────────────────────

export type SerialResult = { code: string; ok: boolean; message: string; id?: number; serial?: string; count?: number; qty?: number };

/** Adds scanned / typed IMEIs to one line of an order. */
export async function adminAddSerials(orderItemId: number, codes: string[]): Promise<Result<{ results: SerialResult[] }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const t = await getT();
  const db = await getDb();
  const [it] = await db
    .select({ id: orderItems.id, orderId: orderItems.orderId, qty: orderItems.qty, status: orders.status })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(orderItems.id, orderItemId));
  if (!it) return { error: "Order item not found" };
  if (it.status === "cancelled") return { error: "This order is cancelled and cannot be changed" };

  const results: SerialResult[] = [];
  for (const code of codes.slice(0, 200)) {
    const c = cleanSerial(code);
    if (c.error !== undefined) {
      results.push({ code, ok: false, message: t(c.error) });
      continue;
    }
    const serial = c.serial;
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(orderSerials)
      .where(eq(orderSerials.orderItemId, orderItemId));
    if (n >= it.qty) {
      results.push({ code, ok: false, message: t("All {n} pieces already have an IMEI", { n: it.qty }) });
      continue;
    }
    const [dup] = await db
      .select({ orderId: orderSerials.orderId, shop: users.shopName })
      .from(orderSerials)
      .innerJoin(orders, eq(orders.id, orderSerials.orderId))
      .innerJoin(users, eq(users.id, orders.userId))
      .where(and(eq(orderSerials.serial, serial), sql`${orders.status} <> 'cancelled'`))
      .limit(1);
    if (dup) {
      results.push({
        code,
        ok: false,
        message:
          dup.orderId === it.orderId
            ? t("{s} is already added", { s: serial })
            : t("{s} is already on order {no} ({shop})", { s: serial, no: orderNo(dup.orderId), shop: dup.shop }),
      });
      continue;
    }
    const [row] = await db
      .insert(orderSerials)
      .values({ orderId: it.orderId, orderItemId, serial })
      .returning({ id: orderSerials.id });
    results.push({
      code,
      ok: true,
      id: row.id,
      serial,
      count: n + 1,
      qty: it.qty,
      message: t("{s} added ({n} of {q})", { s: serial, n: n + 1, q: it.qty }),
    });
  }
  done();
  return { ok: true, results };
}

export async function adminRemoveSerial(id: number): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  await db.delete(orderSerials).where(eq(orderSerials.id, id));
  done();
  return { ok: true };
}

// ───────────────────────── Retailers ─────────────────────────

export async function setRetailerStatus(userId: number, status: "approved" | "blocked" | "pending"): Promise<Result> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  const [before] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId));
  await db
    .update(users)
    .set({ status })
    .where(and(eq(users.id, userId), eq(users.role, "retailer")));
  if (status === "blocked") await db.delete(sessions).where(eq(sessions.userId, userId));
  if (status === "approved" && before && before.status !== "approved") {
    await notify([userId], (t) => ({
      kind: "account",
      title: t("Your shop is approved ✓"),
      body: t("You can now see today's wholesale rates and order."),
      url: "/products",
    }));
  }
  done();
  return { ok: true };
}

/** One-tap login link for a retailer (7 days, works once). */
export async function adminCreateLoginLink(userId: number): Promise<Result<{ url: string }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const db = await getDb();
  const [u] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, userId));
  if (!u || u.role !== "retailer") return { error: "Retailer not found" };
  if (u.status === "blocked") return { error: "This shop is blocked. Unblock it first." };
  const token = await createLoginToken(userId);
  return { ok: true, url: `${await siteUrl()}/l/${token}` };
}

/**
 * Khata: Mama received one amount (e.g. ₹50,000 cash) against the running
 * balance. It is shared over the oldest unpaid orders first.
 */
export async function adminKhataPayment(
  userId: number,
  amount: number,
  method: PaymentMethod,
  reference: string,
): Promise<Result<{ orders: number }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const amt = int(amount);
  if (amt < 1) return { error: "Enter the amount received" };
  if (!PAYMENT_METHODS.includes(method)) return { error: "Choose how it was paid" };
  const due = await getDueOrders(userId);
  const totalDue = due.reduce((s, o) => s + o.due, 0);
  if (!due.length) return { error: "Nothing is due from this shop" };
  if (amt > totalDue) {
    return { error: (await getT())("Amount is more than the balance due ({amount})", { amount: formatINR(totalDue) }) };
  }
  const db = await getDb();
  let left = amt;
  const rows: (typeof payments.$inferInsert)[] = [];
  for (const o of due) {
    if (left <= 0) break;
    const part = Math.min(left, o.due);
    rows.push({ orderId: o.id, amount: part, method, reference: reference.trim().slice(0, 60), status: "verified", byAdmin: true });
    left -= part;
  }
  await db.insert(payments).values(rows);
  await notify([userId], (t) => ({
    kind: "payment",
    title: t("Payment {amount} received ✓", { amount: formatINR(amt) }),
    body: t("Balance now {amount}. Thank you!", { amount: formatINR(totalDue - amt) }),
    url: "/account/khata",
  }));
  done();
  return { ok: true, orders: rows.length };
}

export async function resetRetailerPassword(userId: number): Promise<Result<{ password: string }>> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const password = tempPassword();
  const db = await getDb();
  const updated = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(and(eq(users.id, userId), eq(users.role, "retailer")))
    .returning({ id: users.id });
  if (!updated.length) return { error: "Retailer not found" };
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return { ok: true, password };
}

export type CreateRetailerState = { error?: string; ok?: string; password?: string; phone?: string } | undefined;

/** Mama can add a shop himself and tell them the password on the phone. */
export async function createRetailer(_: CreateRetailerState, form: FormData): Promise<CreateRetailerState> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const name = str(form, "name");
  const shopName = str(form, "shopName");
  const phone = normalizePhone(str(form, "phone"));
  const gstin = str(form, "gstin").toUpperCase();
  if (name.length < 2 || shopName.length < 2) return { error: "Enter name and shop name" };
  if (!phone) return { error: "Enter a valid 10-digit mobile number" };
  if (gstin && !GSTIN_RE.test(gstin)) return { error: "GSTIN looks wrong" };
  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (exists) return { error: "This mobile number is already registered" };
  const password = str(form, "password") || tempPassword();
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  await db.insert(users).values({
    name,
    shopName,
    phone,
    gstin,
    city: str(form, "city"),
    address: str(form, "address"),
    passwordHash: await hashPassword(password),
    status: "approved",
  });
  done();
  return { ok: shopName, password, phone };
}

// ───────────────────────── Demo data ─────────────────────────

/** Before going live: removes the sample shop, its orders, the sample products and the demo admin. */
export async function adminRemoveDemoData(): Promise<Result<{ removed: string[] }>> {
  const me = await getAdminOrNull();
  if (!me) return NOT_ADMIN;
  const db = await getDb();
  const removed: string[] = [];
  await db.transaction(async (tx) => {
    const [demo] = await tx.select({ id: users.id }).from(users).where(eq(users.phone, DEMO_RETAILER_PHONE));
    if (demo) {
      await tx.delete(orders).where(eq(orders.userId, demo.id));
      await tx.delete(users).where(eq(users.id, demo.id));
      removed.push("demo shop + its orders");
    }
    const ps = await tx.delete(products).where(inArray(products.name, DEMO_PRODUCT_NAMES)).returning({ id: products.id });
    if (ps.length) removed.push(`${ps.length} sample products`);
    const [demoAdmin] = await tx.select({ id: users.id }).from(users).where(and(eq(users.phone, DEMO_ADMIN_PHONE), eq(users.role, "admin")));
    if (demoAdmin && demoAdmin.id !== me.id) {
      const [hasOrders] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.userId, demoAdmin.id)).limit(1);
      if (!hasOrders) {
        await tx.delete(users).where(eq(users.id, demoAdmin.id));
        removed.push("demo admin login 9999999999");
      }
    }
  });
  done();
  return { ok: true, removed };
}

// ───────────────────────── Settings ─────────────────────────

export async function saveShopSettings(_: FormState, form: FormData): Promise<FormState> {
  if (!(await getAdminOrNull())) return NOT_ADMIN;
  const values: Partial<Settings> = {};
  for (const key of SETTING_KEYS) {
    if (!form.has(key)) continue;
    let v = str(form, key);
    // keep saved API keys when the masked field is left untouched
    if ((key === "braveApiKey" || key === "serperApiKey") && v.startsWith("••••")) continue;
    if (key === "upiLimit" || key === "lowStockAt") v = String(rupees(v));
    if (key === "maxQtyPerItem") v = String(Math.min(9999, Math.max(1, rupees(v, 50))));
    values[key] = v;
  }
  if (form.has("showStockQtyPresent")) values.showStockQty = form.get("showStockQty") ? "1" : "0";
  if (form.has("autoConfirmPresent")) values.autoConfirmOrders = form.get("autoConfirmOrders") ? "1" : "0";
  if (values.upiId && !isValidUpiId(values.upiId)) return { error: "UPI ID looks wrong (example: laxmi@okaxis)" };
  if (values.gstin && !GSTIN_RE.test(values.gstin.toUpperCase())) return { error: "GSTIN looks wrong" };
  if (values.gstin) values.gstin = values.gstin.toUpperCase();
  if (values.bankIfsc) values.bankIfsc = values.bankIfsc.toUpperCase();
  await saveSettings(values);
  done();
  return { ok: "Settings saved" };
}
