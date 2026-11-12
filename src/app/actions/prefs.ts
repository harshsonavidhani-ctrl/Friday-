"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getDb, notifications, pushSubscriptions, users } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { LANG_COOKIE, toLang, type Lang } from "@/lib/i18n";
import { notify } from "@/lib/notify";

export async function setLanguage(lang: Lang) {
  const l = toLang(lang);
  (await cookies()).set(LANG_COOKIE, l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const me = await getCurrentUser();
  if (me) {
    const db = await getDb();
    await db.update(users).set({ lang: l }).where(eq(users.id, me.id));
  }
  revalidatePath("/", "layout");
}

// Only real browser push services — never let the server post to any other address.
const PUSH_HOSTS = ["googleapis.com", "mozilla.com", "push.apple.com", "notify.windows.com"];

export async function savePushSubscription(sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }) {
  const me = await getCurrentUser();
  if (!me) return { error: "Please login" };
  let url: URL;
  try {
    url = new URL(String(sub.endpoint ?? ""));
  } catch {
    return { error: "Bad subscription" };
  }
  const okHost = PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  const p256dh = String(sub.keys?.p256dh ?? "");
  const auth = String(sub.keys?.auth ?? "");
  if (url.protocol !== "https:" || !okHost || url.href.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return { error: "This browser's alert service is not supported" };
  }
  const db = await getDb();
  await db
    .insert(pushSubscriptions)
    .values({ userId: me.id, endpoint: url.href, p256dh, auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: me.id, p256dh, auth } });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const me = await getCurrentUser();
  if (!me) return;
  const db = await getDb();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, me.id)));
}

export async function sendTestAlert() {
  const me = await getCurrentUser();
  if (!me) return { error: "Please login" };
  await notify([me.id], (t) => ({
    kind: "info",
    title: t("Alerts are working ✓"),
    body: t("You will get alerts like this for orders and payments."),
    url: me.role === "admin" ? "/admin" : "/orders",
  }));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const me = await getCurrentUser();
  if (!me) return;
  const db = await getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}
