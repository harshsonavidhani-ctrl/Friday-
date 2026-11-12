"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cartItems, getDb, orderItems, orders, payments, products, users, variants, PAY_PLANS, type PayPlan } from "@/db";
import { canSeePrices, getCurrentUser } from "@/lib/auth";
import { getCart, getMaxQty } from "@/lib/cart";
import { formatINR, orderNo } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { notifyAdmins } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { getOrderDetails, restoreStock, StockError, takeStock } from "@/lib/orders";
import { rupees, str, type FormState } from "@/lib/validate";

export type CartResult = { ok?: string; error?: string };

/** order lines remember "· Activated" so the bill shows which piece was sold */
const withKind = (label: string, kind: "fresh" | "activated") => (kind === "activated" ? [label, "Activated"].filter(Boolean).join(" · ") : label);

async function approvedUser() {
  const u = await getCurrentUser();
  if (!u) return { error: "Please login to order" } as const;
  if (!canSeePrices(u)) return { error: "Your account is waiting for approval" } as const;
  return { user: u } as const;
}

export async function addToCart(variantId: number, qty: number): Promise<CartResult> {
  const r = await approvedUser();
  if ("error" in r) return { error: r.error };
  const db = await getDb();
  const [v] = await db
    .select({ stock: variants.stock, moq: products.moq, active: products.isActive })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(variants.id, variantId))
    .limit(1);
  if (!v || !v.active) return { error: "This item is not available" };
  if (v.stock <= 0) return { error: "Out of stock" };

  const [existing] = await db
    .select({ qty: cartItems.qty })
    .from(cartItems)
    .where(and(eq(cartItems.userId, r.user.id), eq(cartItems.variantId, variantId)));
  const maxQty = await getMaxQty();
  const wanted = (existing?.qty ?? 0) + Math.max(1, Math.floor(qty));
  const finalQty = Math.min(v.stock, maxQty, Math.max(v.moq, wanted));

  await db
    .insert(cartItems)
    .values({ userId: r.user.id, variantId, qty: finalQty })
    .onConflictDoUpdate({ target: [cartItems.userId, cartItems.variantId], set: { qty: finalQty } });
  revalidatePath("/", "layout");
  const t = await getT();
  return {
    ok:
      finalQty >= wanted
        ? t("Added to cart ({n} pcs)", { n: finalQty })
        : finalQty === maxQty && maxQty < v.stock
          ? t("Maximum {max} pcs per item — {n} in cart", { max: maxQty, n: finalQty })
          : t("Only {stock} available — {n} in cart", { stock: v.stock, n: finalQty }),
  };
}

export async function setCartQty(variantId: number, qty: number): Promise<CartResult> {
  const r = await approvedUser();
  if ("error" in r) return { error: r.error };
  const db = await getDb();
  const where = and(eq(cartItems.userId, r.user.id), eq(cartItems.variantId, variantId));
  if (qty <= 0) {
    await db.delete(cartItems).where(where);
  } else {
    const [v] = await db
      .select({ stock: variants.stock, moq: products.moq })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(eq(variants.id, variantId))
      .limit(1);
    const cap = Math.max(1, Math.min(v?.stock ?? 1, await getMaxQty()));
    const finalQty = Math.min(cap, Math.max(v?.moq ?? 1, Math.floor(qty)));
    await db.update(cartItems).set({ qty: finalQty }).where(where);
  }
  revalidatePath("/", "layout");
  return { ok: "Updated" };
}

export async function placeOrder(_: FormState, form: FormData): Promise<FormState> {
  const r = await approvedUser();
  if ("error" in r) return { error: r.error };
  const user = r.user;

  const deliveryMethod = str(form, "deliveryMethod") === "parcel" ? "parcel" : "pickup";
  const planRaw = str(form, "payPlan");
  const payPlan: PayPlan = (PAY_PLANS as readonly string[]).includes(planRaw) ? (planRaw as PayPlan) : "upi";
  const address = str(form, "address").slice(0, 500);
  const notes = str(form, "notes").slice(0, 500);
  if (deliveryMethod === "parcel" && address.length < 5) {
    return { error: "Enter the full address / transport name for the parcel" };
  }

  const lines = await getCart(user.id);
  if (!lines.length) return { error: "Your cart is empty" };
  const t = await getT();
  const problems = lines.filter((l) => l.problem).map((l) => `${l.name} ${l.label}: ${t(l.problem!.text, l.problem!.vars)}`);
  if (problems.length) return { error: `${t("Please fix your cart")} — ${problems.join("; ")}` };

  const db = await getDb();
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const pieces = lines.reduce((s, l) => s + l.qty, 0);
  // Mama can let orders confirm themselves (Settings → Confirm orders automatically)
  const autoConfirm = (await getSettings()).autoConfirmOrders !== "0";
  let orderId: number;
  try {
    orderId = await db.transaction(async (tx) => {
      const [o] = await tx
        .insert(orders)
        .values({
          userId: user.id,
          status: autoConfirm ? "confirmed" : "pending",
          deliveryMethod,
          address: deliveryMethod === "parcel" ? address : "",
          notes,
          payPlan,
          subtotal,
          total: subtotal,
        })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values(
        lines.map((l) => ({
          orderId: o.id,
          variantId: l.variantId,
          productId: l.productId,
          name: l.name,
          variantLabel: withKind(l.label, l.kind),
          image: l.image,
          price: l.price,
          qty: l.qty,
        })),
      );
      for (const l of lines) await takeStock(tx, l.variantId, l.qty, `${l.name} ${l.label}`.trim());
      await tx.delete(cartItems).where(eq(cartItems.userId, user.id));
      return o.id;
    });
  } catch (e) {
    if (e instanceof StockError) return { error: `${e.message}. ${(await getT())("Please check your cart.")}` };
    throw e;
  }

  if (deliveryMethod === "parcel" && !user.address) {
    await db.update(users).set({ address }).where(eq(users.id, user.id));
  }
  await notifyAdmins((t) => ({
    kind: "order",
    title: t("New order {no} · {amount}", { no: orderNo(orderId), amount: formatINR(subtotal) }),
    body: `${user.shopName || user.name} — ${t("{n} pcs", { n: pieces })} · ${deliveryMethod === "parcel" ? t("Parcel") : t("Pickup")}`,
    url: `/admin/orders/${orderId}`,
  }));
  revalidatePath("/", "layout");
  // online → the payment page comes next; cash / credit → straight to "Order confirmed"
  redirect(payPlan === "upi" || payPlan === "bank" ? `/orders/${orderId}/pay` : `/orders/${orderId}?placed=1`);
}

export async function cancelMyOrder(orderId: number): Promise<CartResult> {
  const u = await getCurrentUser();
  if (!u) return { error: "Please login" };
  const db = await getDb();
  const done = await db.transaction(async (tx) => {
    const [o] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, u.id)))
      .for("update");
    if (!o || o.status !== "pending") return "not-pending";
    const [paid] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, orderId), ne(payments.status, "rejected")))
      .limit(1);
    if (paid) return "paid";
    await restoreStock(tx, orderId);
    await tx.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
    return "ok";
  });
  if (done === "paid") return { error: "You have already paid for this order — please call the shop to cancel it." };
  if (done !== "ok") return { error: "Only orders awaiting confirmation can be cancelled. Please call the shop." };
  await notifyAdmins((t) => ({
    kind: "order",
    title: t("Order {no} cancelled by the retailer", { no: orderNo(orderId) }),
    body: u.shopName || u.name,
    url: `/admin/orders/${orderId}`,
  }));
  revalidatePath("/", "layout");
  return { ok: "Order cancelled" };
}

export async function submitPayment(_: FormState, form: FormData): Promise<FormState> {
  const u = await getCurrentUser();
  if (!u) return { error: "Please login" };
  const orderId = Number(form.get("orderId"));
  const amount = rupees(form.get("amount"));
  const reference = str(form, "reference").replace(/\s+/g, "").toUpperCase();
  const method = str(form, "method") === "bank" ? "bank" : "upi";

  const d = await getOrderDetails(orderId);
  if (!d || d.order.userId !== u.id) return { error: "Order not found" };
  if (d.order.status === "cancelled") return { error: "This order is cancelled" };
  if (amount < 1) return { error: "Enter the amount you paid" };
  if (amount > d.pay.balance) return { error: `Amount is more than the balance due` };
  if (!/^[A-Z0-9]{6,35}$/.test(reference)) {
    return { error: "Enter the 12-digit UPI reference / UTR number from your payment app" };
  }
  if (d.payments.some((p) => p.reference === reference && p.status !== "rejected")) {
    return { error: "This reference number was already submitted" };
  }
  const db = await getDb();
  await db.insert(payments).values({ orderId, amount, method, reference, status: "submitted" });
  await notifyAdmins((t) => ({
    kind: "payment",
    title: t("Payment {amount} to verify", { amount: formatINR(amount) }),
    body: `${u.shopName || u.name} · ${orderNo(orderId)} · ${method === "bank" ? t("Bank") : "UPI"} ${reference}`,
    url: `/admin/orders/${orderId}`,
  }));
  revalidatePath("/", "layout");
  return { ok: "Thank you! Mama will verify the payment shortly." };
}
