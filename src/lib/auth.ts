import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, loginTokens, sessions, users } from "@/db";
import { appRole } from "@/lib/sites";

const COOKIE = "la_session";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days — retailers stay logged in
export const LOGIN_LINK_DAYS = 7;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number, opts: { viaLink?: boolean } = {}) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + MAX_AGE * 1000),
    viaLink: !!opts.viaLink,
  });
  // tidy up this user's expired sessions
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  jar.delete(COOKIE);
}

/** Hash of this browser's session id (to keep it while logging out other devices). */
export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt, viaLink: sessions.viaLink })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);
  if (!row || row.expiresAt < new Date() || row.user.status === "blocked") return null;
  // Online the two apps never share an account: the shops' app ignores Mama's
  // login and Mama's app ignores shop logins (src/lib/sites.ts). Laptop: both work.
  if (!accountFitsThisSite(row.user.role)) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...user } = row.user;
  return { ...user, viaLink: row.viaLink };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Mama's account only on Mama's site, shop accounts only on the shops' site (laptop: any). */
export function accountFitsThisSite(role: string): boolean {
  const site = appRole();
  if (site === "shop") return role !== "admin";
  if (site === "admin") return role === "admin";
  return true;
}

export function canSeePrices(u: CurrentUser | null): boolean {
  return !!u && (u.role === "admin" || u.status === "approved");
}

export async function requireUser(next = "/") {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireApproved(next = "/") {
  const u = await requireUser(next);
  if (!canSeePrices(u)) redirect("/account");
  return u;
}

export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  if (u.role !== "admin") redirect("/admin/login");
  return u;
}

/** For route handlers / actions that must not redirect. */
export async function getAdminOrNull() {
  const u = await getCurrentUser();
  return u?.role === "admin" ? u : null;
}

// ───────────── One-tap login links (sent by Mama on WhatsApp) ─────────────

export async function createLoginToken(userId: number): Promise<string> {
  const db = await getDb();
  const token = randomBytes(24).toString("base64url");
  await db.insert(loginTokens).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + LOGIN_LINK_DAYS * 86400 * 1000),
  });
  // old unused links stay valid until they expire; clean up expired ones
  await db.delete(loginTokens).where(and(eq(loginTokens.userId, userId), lt(loginTokens.expiresAt, new Date())));
  return token;
}

/** Looks a link up without using it (the page shows "Login as …"). */
export async function peekLoginToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = await getDb();
  const [r] = await db
    .select({ usedAt: loginTokens.usedAt, expiresAt: loginTokens.expiresAt, name: users.name, shopName: users.shopName, status: users.status, role: users.role })
    .from(loginTokens)
    .innerJoin(users, eq(users.id, loginTokens.userId))
    .where(eq(loginTokens.id, hashToken(token)))
    .limit(1);
  if (!r) return null;
  return { ...r, valid: !r.usedAt && r.expiresAt > new Date() && r.status !== "blocked" };
}

/** Marks a link used (once only) and returns the user id. */
export async function consumeLoginToken(token: string): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = await getDb();
  const [r] = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(loginTokens.id, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())))
    .returning({ userId: loginTokens.userId });
  return r?.userId ?? null;
}
