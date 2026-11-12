"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, sessions, users } from "@/db";
import {
  accountFitsThisSite,
  consumeLoginToken,
  createSession,
  currentSessionId,
  destroySession,
  getCurrentUser,
  peekLoginToken,
} from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearLimit, clientIp, hit, isLimited } from "@/lib/rate-limit";
import { GSTIN_RE, normalizePhone, safeNext, str, type FormState } from "@/lib/validate";

const TOO_MANY = "Too many wrong tries. Please wait 15 minutes, or ask the shop for a login link.";

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const phone = normalizePhone(str(form, "phone"));
  const password = str(form, "password");
  if (!phone) return { error: "Enter your 10-digit mobile number" };
  if (!password) return { error: "Enter your password" };

  const ip = await clientIp();
  if ((await isLimited(`login:p:${phone}`, 8)) || (await isLimited(`login:ip:${ip}`, 40))) return { error: TOO_MANY };

  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!u || !(await verifyPassword(password, u.passwordHash))) {
    await hit(`login:p:${phone}`, 900);
    await hit(`login:ip:${ip}`, 900);
    return { error: "Wrong mobile number or password" };
  }
  if (u.status === "blocked") return { error: "This account is blocked. Please call the shop." };
  // two separate apps: Mama's admin app and the retailers' app
  const mode = str(form, "mode") === "admin" ? "admin" : "shop";
  if (mode === "admin" && u.role !== "admin") return { error: "This login is only for Mama. Shops: please use the Laxmi Associates app." };
  if (mode === "shop" && u.role === "admin") return { error: "This is the shops' login. Mama: please open your Mama app (/admin)." };

  await clearLimit(`login:p:${phone}`);
  await createSession(u.id);
  revalidatePath("/", "layout");
  const next = safeNext(str(form, "next"), u.role === "admin" ? "/admin" : "/");
  redirect(u.role === "admin" ? (next.startsWith("/admin") ? next : "/admin") : next.startsWith("/admin") ? "/" : next);
}

export async function logoutAdmin() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/admin/login");
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const name = str(form, "name");
  const shopName = str(form, "shopName");
  const phone = normalizePhone(str(form, "phone"));
  const password = str(form, "password");
  const city = str(form, "city");
  const address = str(form, "address");
  const gstin = str(form, "gstin").toUpperCase();

  if (name.length < 2) return { error: "Enter your name" };
  if (shopName.length < 2) return { error: "Enter your shop name" };
  if (!phone) return { error: "Enter a valid 10-digit mobile number" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  if (gstin && !GSTIN_RE.test(gstin)) return { error: "GSTIN looks wrong (15 characters, e.g. 23ABCDE1234F1Z5)" };

  if ((await hit(`register:ip:${await clientIp()}`, 3600)) > 10) {
    return { error: "Too many registrations from this network. Please try again later." };
  }

  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
  if (exists) return { error: "This mobile number is already registered. Please login." };

  const [u] = await db
    .insert(users)
    .values({
      name: name.slice(0, 80),
      shopName: shopName.slice(0, 100),
      phone,
      passwordHash: await hashPassword(password),
      city: city.slice(0, 60),
      address: address.slice(0, 300),
      gstin,
    })
    .returning({ id: users.id });
  await createSession(u.id);
  await notifyAdmins((t) => ({
    kind: "account",
    title: t("New shop waiting for approval"),
    body: [shopName, name, phone, city].filter(Boolean).join(" · "),
    url: `/admin/retailers/${u.id}`,
  }));
  revalidatePath("/", "layout");
  redirect("/account?welcome=1");
}

export async function logout() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please login again" };
  const gstin = str(form, "gstin").toUpperCase();
  if (gstin && !GSTIN_RE.test(gstin)) return { error: "GSTIN looks wrong (15 characters)" };
  const name = str(form, "name");
  const shopName = str(form, "shopName");
  if (name.length < 2 || shopName.length < 2) return { error: "Name and shop name are required" };
  const db = await getDb();
  await db
    .update(users)
    .set({
      name: name.slice(0, 80),
      shopName: shopName.slice(0, 100),
      gstin,
      city: str(form, "city").slice(0, 60),
      address: str(form, "address").slice(0, 300),
    })
    .where(eq(users.id, me.id));
  revalidatePath("/", "layout");
  return { ok: "Profile saved" };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please login again" };
  const current = str(form, "current");
  const next = str(form, "new");
  if (next.length < 6) return { error: "New password must be at least 6 characters" };
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  // after a one-tap login link, the old password is not needed
  if (!me.viaLink && !(await verifyPassword(current, u.passwordHash))) return { error: "Current password is wrong" };
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, me.id));
  // log out other devices, keep this one
  const keep = await currentSessionId();
  await db
    .delete(sessions)
    .where(keep ? and(eq(sessions.userId, me.id), ne(sessions.id, keep)) : eq(sessions.userId, me.id));
  if (keep) await db.update(sessions).set({ viaLink: false }).where(eq(sessions.id, keep));
  revalidatePath("/", "layout");
  return { ok: "Password saved" };
}

/** The "Login" button on a one-tap link page. */
export async function loginWithLink(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if ((await hit(`link:ip:${ip}`, 900)) > 30) return { error: "Too many tries. Please wait a few minutes." };
  // never use up a Mama link on the shops' site (or a shop's link on Mama's site)
  const peek = await peekLoginToken(str(form, "token"));
  if (peek?.valid && !accountFitsThisSite(peek.role)) {
    return { error: peek.role === "admin" ? "This is Mama's link — open it in Mama's app." : "This is a shop's link — open it in the shops' app." };
  }
  const userId = await consumeLoginToken(str(form, "token"));
  if (!userId) return { error: "This link has expired or was already used. Ask the shop for a new one." };
  const db = await getDb();
  const [u] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, userId));
  if (!u || u.status === "blocked") return { error: "This account is blocked. Please call the shop." };
  await createSession(userId, { viaLink: true });
  revalidatePath("/", "layout");
  redirect("/account?link=1");
}

/** "Forgot password" — tells Mama, who sends a one-tap login link. */
export async function requestLoginHelp(_: FormState, form: FormData): Promise<FormState> {
  const phone = normalizePhone(str(form, "phone"));
  if (!phone) return { error: "Enter your 10-digit mobile number" };
  const ip = await clientIp();
  const tooMany = (await hit(`help:p:${phone}`, 3600)) > 3 || (await hit(`help:ip:${ip}`, 3600)) > 10;
  const ok = { ok: "Request sent. You will get a login link on WhatsApp soon." };
  if (tooMany) return ok;
  const db = await getDb();
  const [u] = await db
    .select({ id: users.id, name: users.name, shopName: users.shopName, role: users.role })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  // same answer whether or not the number exists (so nobody can check numbers)
  if (u && u.role === "retailer") {
    await notifyAdmins((t) => ({
      kind: "account",
      title: t("{shop} forgot the password", { shop: u.shopName || u.name }),
      body: t("Send a login link: open the shop and tap “Login link”. Phone {phone}", { phone }),
      url: `/admin/retailers/${u.id}?link=1`,
    }));
  }
  return ok;
}
