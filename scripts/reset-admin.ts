/**
 * Mama forgot his password (or wants a fresh start)? Nobody is above the admin to
 * send him a login link, so this does it from the laptop:
 *
 *   npm run admin:reset -- 98xxxxxxxx            (laptop: stop `npm run dev` first)
 *   $env:DATABASE_URL="…"; npm run admin:reset -- 98xxxxxxxx   (live site)
 *
 * It switches the old password off, logs that phone out everywhere and prints a
 * one-time link (valid 1 hour). Open it → "Login now" → set a new password.
 */
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, loginTokens, sessions, users } from "../src/db";
import { hashPassword } from "../src/lib/password";
import { normalizePhone } from "../src/lib/validate";

async function main() {
  const phone = normalizePhone(process.argv[2] ?? "");
  if (!phone) throw new Error("Give the 10-digit mobile number, e.g. npm run admin:reset -- 9876543210");
  const db = await getDb();
  const [u] = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.phone, phone));
  if (!u) throw new Error(`No account with mobile ${phone}`);

  // old password no longer works; every device is logged out
  await db.update(users).set({ passwordHash: await hashPassword(randomBytes(32).toString("base64url")) }).where(eq(users.id, u.id));
  await db.delete(sessions).where(eq(sessions.userId, u.id));

  const token = randomBytes(24).toString("base64url");
  await db.insert(loginTokens).values({
    id: createHash("sha256").update(token).digest("hex"),
    userId: u.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(`✓ Old password switched off for ${u.name} (${phone}, ${u.role}). Logged out on all devices.`);
  console.log(`\nOne-time login link (works once, for 1 hour):\n${site}/l/${token}\n`);
  if (!process.env.NEXT_PUBLIC_SITE_URL) console.log("On a phone on the same Wi-Fi, replace localhost with the laptop's address (e.g. 192.168.1.5).");
  process.exit(0);
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
