import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { seed } from "./seed";

export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Two modes:
 *  - DATABASE_URL set  -> real Postgres (Supabase) for the live website.
 *    Run `npm run db:setup` once to create tables + the admin account.
 *  - no DATABASE_URL   -> PGlite, a Postgres that runs inside this app and
 *    stores data in ./.data/pglite. Tables and demo data are created
 *    automatically on first start. Perfect for testing on this laptop.
 */
async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    // prepare:false is required by Supabase's connection pooler; serverless hosts
    // run many small copies of the app, so each keeps only a few connections
    const client = postgres(url, { prepare: false, max: Number(process.env.DB_POOL_MAX) || 3, idle_timeout: 20 });
    return drizzle(client, { schema });
  }

  // Hosted servers (Netlify / AWS) cannot keep a laptop database — say so clearly
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error("DATABASE_URL is not set on the server — add it in Netlify → Project configuration → Environment variables, then redeploy.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.join(process.cwd(), ".data");
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(path.join(dataDir, "pglite"));
  await client.waitReady;
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seed(db as unknown as DB, { demo: true });
  return db as unknown as DB;
}

const g = globalThis as unknown as { __laDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__laDb) {
    g.__laDb = init().catch((err) => {
      g.__laDb = undefined;
      throw err;
    });
  }
  return g.__laDb;
}

export * from "./schema";
