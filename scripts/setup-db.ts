/**
 * One-time setup for the LIVE database (Supabase Postgres).
 *
 *   $env:DATABASE_URL="postgresql://..."; $env:ADMIN_PHONE="98xxxxxxxx"; $env:ADMIN_PASSWORD="..."
 *   npm run db:setup
 *
 * Creates/updates all tables and, on an empty database, Mama's admin
 * account + default categories. Safe to run again after updates.
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";
import type { DB } from "../src/db/index";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL first");
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("✓ Tables ready");

  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !password || password.length < 6) {
    console.log("! ADMIN_PHONE / ADMIN_PASSWORD (6+ chars) not set — skipping admin creation");
  } else {
    await seed(db as unknown as DB, { demo: false, adminPhone: phone, adminPassword: password });
    console.log("✓ Admin + default categories ready (skipped if users already existed)");
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
