import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, rateLimits } from "@/db";

/** Counts one attempt for `key`; returns how many were made in the current window. */
export async function hit(key: string, windowSec: number): Promise<number> {
  const db = await getDb();
  const interval = sql.raw(`interval '${Math.max(1, Math.floor(windowSec))} seconds'`);
  const [r] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + ${interval}` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then now() + ${interval} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return r?.count ?? 1;
}

/** True when `key` already used up `limit` attempts in its current window. */
export async function isLimited(key: string, limit: number): Promise<boolean> {
  const db = await getDb();
  const [r] = await db
    .select({ count: rateLimits.count, active: sql<boolean>`${rateLimits.resetAt} > now()` })
    .from(rateLimits)
    .where(eq(rateLimits.key, key));
  return !!r && r.active && r.count >= limit;
}

export async function clearLimit(key: string) {
  const db = await getDb();
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim().slice(0, 64);
}
