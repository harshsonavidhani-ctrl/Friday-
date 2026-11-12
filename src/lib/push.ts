import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { getDb, pushSubscriptions, settings } from "@/db";

type Keys = { publicKey: string; privateKey: string };
const g = globalThis as unknown as { __laVapid?: Promise<Keys> };

/**
 * Keys that prove phone alerts really come from this website.
 * Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY on the live site, otherwise a pair
 * is created once and saved in the database (never shown to anyone).
 */
export function getVapidKeys(): Promise<Keys> {
  if (!g.__laVapid) {
    g.__laVapid = loadKeys().catch((e) => {
      g.__laVapid = undefined;
      throw e;
    });
  }
  return g.__laVapid;
}

async function loadKeys(): Promise<Keys> {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  const db = await getDb();
  const read = async () => {
    const rows = await db.select().from(settings).where(inArray(settings.key, ["_vapidPublic", "_vapidPrivate"]));
    const m = new Map(rows.map((r) => [r.key, r.value]));
    const publicKey = m.get("_vapidPublic");
    const privateKey = m.get("_vapidPrivate");
    return publicKey && privateKey ? { publicKey, privateKey } : null;
  };
  const found = await read();
  if (found) return found;
  const k = webpush.generateVAPIDKeys();
  await db
    .insert(settings)
    .values([
      { key: "_vapidPublic", value: k.publicKey },
      { key: "_vapidPrivate", value: k.privateKey },
    ])
    .onConflictDoNothing();
  return (await read()) ?? k;
}

function subject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return site?.startsWith("https://") ? site : "mailto:alerts@example.com";
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends to every phone/computer where these people turned alerts on. Never throws. */
export async function sendPush(messages: { userId: number; payload: PushPayload }[]) {
  if (!messages.length) return;
  try {
    const db = await getDb();
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, [...new Set(messages.map((m) => m.userId))]));
    if (!subs.length) return;
    const keys = await getVapidKeys();
    const vapidDetails = { subject: subject(), ...keys };
    await Promise.all(
      subs.flatMap((s) =>
        messages
          .filter((m) => m.userId === s.userId)
          .map(async (m) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify(m.payload),
                { vapidDetails, TTL: 60 * 60 * 24, urgency: "high", timeout: 10000 },
              );
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              // phone uninstalled the app / turned alerts off
              if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
              else console.warn("[push] failed", code ?? (e as Error).message);
            }
          }),
      ),
    );
  } catch (e) {
    console.warn("[push] error", (e as Error).message);
  }
}
