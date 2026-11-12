/**
 * Removes the demo data from the laptop database (same as Settings → "Remove demo data"):
 * demo shop 8888888888 + its orders, the 8 sample products, demo admin 9999999999.
 * Stop the app first (the laptop database can only be open in one program).
 *   npx tsx scripts/remove-demo.ts
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, orders, products, users } from "../src/db";
import { DEMO_ADMIN_PHONE, DEMO_PRODUCT_NAMES, DEMO_RETAILER_PHONE } from "../src/db/seed";

async function main() {
  const db = await getDb();
  const removed: string[] = [];
  await db.transaction(async (tx) => {
    const [demo] = await tx.select({ id: users.id }).from(users).where(eq(users.phone, DEMO_RETAILER_PHONE));
    if (demo) {
      const os = await tx.delete(orders).where(eq(orders.userId, demo.id)).returning({ id: orders.id });
      await tx.delete(users).where(eq(users.id, demo.id));
      removed.push(`demo shop ${DEMO_RETAILER_PHONE} + ${os.length} test orders`);
    }
    const ps = await tx.delete(products).where(inArray(products.name, DEMO_PRODUCT_NAMES)).returning({ id: products.id });
    if (ps.length) removed.push(`${ps.length} sample products`);
    const [admin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, DEMO_ADMIN_PHONE), eq(users.role, "admin")));
    if (admin) {
      const [hasOrders] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.userId, admin.id)).limit(1);
      if (hasOrders) removed.push(`demo admin ${DEMO_ADMIN_PHONE} KEPT (has orders)`);
      else {
        await tx.delete(users).where(eq(users.id, admin.id));
        removed.push(`demo admin login ${DEMO_ADMIN_PHONE}`);
      }
    }
  });
  console.log(removed.length ? `Removed: ${removed.join(", ")}` : "No demo data left.");
  const left = await db.select({ phone: users.phone, role: users.role, shop: users.shopName }).from(users);
  console.log("Accounts now:", left.map((u) => `${u.phone} (${u.role}${u.shop ? ", " + u.shop : ""})`).join(" · "));
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(products);
  console.log("Products now:", n);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
