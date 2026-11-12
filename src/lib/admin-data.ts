import { and, asc, desc, eq, sql } from "drizzle-orm";
import { categories, getDb, orders, payments, products, users, variants } from "@/db";
import { getSettings } from "./settings";

export async function getAdminCounts() {
  const db = await getDb();
  const [r] = rowsOf<{ pending_orders: number; to_verify: number; new_retailers: number }>(
    await db.execute(sql`
    select
      (select count(*) from orders where status = 'pending')::int as pending_orders,
      (select count(*) from payments where status = 'submitted')::int as to_verify,
      (select count(*) from users where role = 'retailer' and status = 'pending')::int as new_retailers
  `),
  );
  return {
    pendingOrders: Number(r?.pending_orders ?? 0),
    toVerify: Number(r?.to_verify ?? 0),
    newRetailers: Number(r?.new_retailers ?? 0),
  };
}

/** postgres-js returns an array, PGlite returns { rows } — normalise. */
function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

export async function getDashboardStats() {
  const db = await getDb();
  const [r] = rowsOf<{
    today_sales: number;
    today_orders: number;
    outstanding: number;
    products: number;
    out_of_stock: number;
  }>(await db.execute(sql`
    select
      (select coalesce(sum(total),0) from orders
        where status <> 'cancelled'
        and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)::bigint as today_sales,
      (select count(*) from orders
        where status <> 'cancelled'
        and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)::int as today_orders,
      (select coalesce(sum(o.total - coalesce((select sum(p.amount) from payments p where p.order_id = o.id and p.status = 'verified'),0)),0)
        from orders o where o.status not in ('cancelled','pending'))::bigint as outstanding,
      (select count(*) from products where is_active)::int as products,
      (select count(*) from variants v join products p on p.id = v.product_id where p.is_active and v.stock <= 0)::int as out_of_stock
  `));
  return {
    todaySales: Number(r?.today_sales ?? 0),
    todayOrders: Number(r?.today_orders ?? 0),
    outstanding: Math.max(0, Number(r?.outstanding ?? 0)),
    products: Number(r?.products ?? 0),
    outOfStock: Number(r?.out_of_stock ?? 0),
  };
}

export async function getLowStock() {
  const db = await getDb();
  const s = await getSettings();
  const limit = Number(s.lowStockAt) || 3;
  return db
    .select({
      variantId: variants.id,
      productId: products.id,
      name: products.name,
      label: variants.label,
      stock: variants.stock,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(products.isActive, true), sql`${variants.stock} <= ${limit}`))
    .orderBy(asc(variants.stock), asc(products.name))
    .limit(12);
}

/** Every variant, for the Prices & Stock screen and the rate list. */
export async function getAllVariantsForAdmin() {
  const db = await getDb();
  return db
    .select({
      id: variants.id,
      productId: products.id,
      name: products.name,
      brand: products.brand,
      image: sql<string | null>`${products.images}->>0`,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySort: categories.sortOrder,
      isActive: products.isActive,
      label: variants.label,
      kind: variants.kind,
      modelNumber: variants.modelNumber,
      price: variants.price,
      mrp: variants.mrp,
      stock: variants.stock,
      priceUpdatedAt: variants.priceUpdatedAt,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(asc(sql`coalesce(${categories.sortOrder}, 9999)`), asc(products.name), asc(variants.sortOrder));
}

export async function getRetailers() {
  const db = await getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      shopName: users.shopName,
      phone: users.phone,
      gstin: users.gstin,
      city: users.city,
      address: users.address,
      status: users.status,
      createdAt: users.createdAt,
      // "users"."id" written out in full: in a query without joins drizzle prints just "id",
      // which inside the sub-query would mean o.id (a wrong count)
      orderCount: sql<number>`(select count(*) from orders o where o.user_id = "users"."id" and o.status <> 'cancelled')`.mapWith(Number),
      outstanding: sql<number>`(select coalesce(sum(o.total - coalesce((select sum(p.amount) from payments p where p.order_id = o.id and p.status = 'verified'),0)),0) from orders o where o.user_id = "users"."id" and o.status not in ('cancelled','pending'))`.mapWith(Number),
    })
    .from(users)
    .where(eq(users.role, "retailer"))
    .orderBy(desc(users.createdAt));
}

export async function getPaymentsToVerify() {
  const db = await getDb();
  return db
    .select({ payment: payments, orderId: orders.id, shopName: users.shopName })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(payments.status, "submitted"))
    .orderBy(asc(payments.createdAt));
}
