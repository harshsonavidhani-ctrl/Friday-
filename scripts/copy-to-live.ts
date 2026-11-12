/**
 * Copies everything from this laptop (PGlite in .data/) to the LIVE database
 * (Supabase) — products, photos, shops, orders, payments, khata, settings.
 *
 *   1. Stop `npm run dev` first (the laptop database can only be open once).
 *   2. $env:DATABASE_URL="postgresql://..."; $env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   3. npm run db:copy-to-live            (live database must be empty)
 *      npm run db:copy-to-live -- --wipe  (DELETES everything on the live site first)
 *
 * Logins on the laptop are not copied (everyone logs in again once on the live site).
 * Phone-alert subscriptions are not copied (turn alerts on again on the live site).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getTableColumns, sql, type Table } from "drizzle-orm";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { migrate as migrateLocal } from "drizzle-orm/pglite/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as s from "../src/db/schema";

// parents before children (foreign keys)
const TABLES: [string, Table, boolean][] = [
  ["users", s.users, true],
  ["categories", s.categories, true],
  ["products", s.products, true],
  ["variants", s.variants, true],
  ["rate_messages", s.rateMessages, true],
  ["rate_aliases", s.rateAliases, false],
  ["cart_items", s.cartItems, false],
  ["orders", s.orders, true],
  ["order_items", s.orderItems, true],
  ["order_serials", s.orderSerials, true],
  ["payments", s.payments, true],
  ["settings", s.settings, false],
  ["notifications", s.notifications, true],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (the live Supabase database) first");
  const wipe = process.argv.includes("--wipe");
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "product-images";

  const local = new PGlite(path.join(process.cwd(), ".data", "pglite"));
  await local.waitReady;
  const from = pgliteDrizzle(local, { schema: s });
  // bring the laptop database up to date first (new columns since it was last opened)
  await migrateLocal(from, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const client = postgres(url, { prepare: false, max: 1 });
  const to = drizzle(client, { schema: s });

  await migrate(to, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("✓ live tables ready");

  const [{ n }] = await client`select count(*)::int as n from users`;
  if (n > 0 && !wipe) {
    throw new Error(`The live database already has ${n} users. Run again with --wipe to replace everything (cannot be undone).`);
  }
  if (wipe) {
    await client.unsafe(
      `truncate ${[...TABLES.map(([t]) => t), "sessions", "login_tokens", "push_subscriptions", "rate_limits"].join(", ")} restart identity cascade`,
    );
    console.log("✓ live database emptied");
  }

  // photos saved on the laptop (/uploads/x.webp) → Supabase Storage
  const moved = new Map<string, string>();
  async function movePhoto(u: string | null): Promise<string | null> {
    if (!u || !u.startsWith("/uploads/")) return u;
    if (moved.has(u)) return moved.get(u)!;
    if (!supaUrl || !supaKey) throw new Error("Laptop photos found — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload them");
    const name = u.slice("/uploads/".length);
    const buf = await readFile(path.join(process.cwd(), ".data", "uploads", name));
    const res = await fetch(`${supaUrl}/storage/v1/object/${bucket}/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supaKey}`, "Content-Type": "image/webp", "x-upsert": "true", "Cache-Control": "max-age=31536000" },
      body: new Uint8Array(buf),
    });
    if (!res.ok) throw new Error(`Photo upload failed for ${name} (${res.status}) — is the "${bucket}" bucket created and public?`);
    const live = `${supaUrl}/storage/v1/object/public/${bucket}/${name}`;
    moved.set(u, live);
    return live;
  }

  for (const [name, table, serial] of TABLES) {
    let rows = (await from.select().from(table)) as Record<string, unknown>[];
    if (name === "products") {
      for (const r of rows) r.images = await Promise.all((r.images as string[]).map((x) => movePhoto(x)));
    }
    if (name === "order_items") {
      for (const r of rows) r.image = await movePhoto(r.image as string | null);
    }
    if (name === "settings" && process.env.VAPID_PUBLIC_KEY) {
      // the live site has its own alert keys — don't copy the laptop's
      rows = rows.filter((r) => r.key !== "_vapidPublic" && r.key !== "_vapidPrivate");
    }
    for (let i = 0; i < rows.length; i += 500) {
      await to.insert(table).values(rows.slice(i, i + 500) as never).onConflictDoNothing();
    }
    if (serial && "id" in getTableColumns(table)) {
      await to.execute(sql.raw(`select setval(pg_get_serial_sequence('${name}', 'id'), coalesce((select max(id) from ${name}), 0) + 1, false)`));
    }
    console.log(`✓ ${name}: ${rows.length}`);
  }
  console.log(`✓ photos uploaded: ${moved.size}`);
  await client.end();
  await local.close();
  console.log("\nDone. Open the live website and login with the same mobile number + password as on the laptop.");
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
