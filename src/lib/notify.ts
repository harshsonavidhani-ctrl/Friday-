import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb, notifications, users } from "@/db";
import { makeT, toLang, type T } from "./i18n";
import { sendPush } from "./push";

export type NoteKind = "order" | "payment" | "account" | "info";
export type Note = { kind: NoteKind; title: string; body?: string; url?: string };

/** Run after the response is sent (falls back to fire-and-forget outside a request). */
function later(fn: () => Promise<void>) {
  try {
    after(fn);
  } catch {
    void fn().catch((e) => console.warn("[notify]", e));
  }
}

/**
 * Saves an alert for each person (bell icon) and sends it to their phones.
 * `make` is called with each person's language, so Hindi users get Hindi.
 */
export async function notify(userIds: number[], make: (t: T) => Note) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    const db = await getDb();
    const people = await db.select({ id: users.id, lang: users.lang }).from(users).where(inArray(users.id, ids));
    const rows = people.map((p) => {
      const n = make(makeT(toLang(p.lang)));
      return { userId: p.id, kind: n.kind, title: n.title.slice(0, 200), body: (n.body ?? "").slice(0, 500), url: n.url ?? "" };
    });
    if (!rows.length) return;
    await db.insert(notifications).values(rows);
    later(() =>
      sendPush(rows.map((r) => ({ userId: r.userId, payload: { title: r.title, body: r.body, url: r.url || "/", tag: r.url || undefined } }))),
    );
  } catch (e) {
    // an alert must never break placing an order or saving a payment
    console.warn("[notify] failed", (e as Error).message);
  }
}

export async function notifyAdmins(make: (t: T) => Note) {
  const db = await getDb();
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.status, "blocked")));
  await notify(
    admins.map((a) => a.id),
    make,
  );
}

export async function getUnreadCount(userId: number): Promise<number> {
  const db = await getDb();
  const [r] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function getNotifications(userId: number, limit = 60) {
  const db = await getDb();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}
