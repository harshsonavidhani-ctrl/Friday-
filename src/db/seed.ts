import { sql } from "drizzle-orm";
import { hashPassword } from "../lib/password";
import type { DB } from "./index";
import { categories, products, settings, users, variants } from "./schema";

const DEFAULT_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Mobiles", icon: "smartphone" },
  { name: "Tablets", icon: "tablet" },
  { name: "Smart TVs", icon: "tv" },
  { name: "Microwave Ovens", icon: "microwave" },
  { name: "Refrigerators", icon: "refrigerator" },
  { name: "Washing Machines", icon: "washing-machine" },
  { name: "Air Conditioners", icon: "air-vent" },
  { name: "Audio & Speakers", icon: "speaker" },
  { name: "Smart Watches", icon: "watch" },
  { name: "Kitchen Appliances", icon: "cooking-pot" },
  { name: "Accessories", icon: "cable" },
];

type DemoProduct = {
  name: string;
  brand: string;
  category: string;
  moq?: number;
  description?: string;
  specs?: { label: string; value: string }[];
  variants: { label: string; price: number; mrp?: number; stock: number; modelNumber?: string; prevPrice?: number }[];
};

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    category: "Mobiles",
    description: "Sealed box with 1 year Samsung India warranty.",
    specs: [
      { label: "Display", value: '6.8" QHD+ Dynamic AMOLED 2X, 120Hz' },
      { label: "Processor", value: "Snapdragon 8 Gen 3 for Galaxy" },
      { label: "Rear Camera", value: "200MP + 50MP + 12MP + 10MP" },
      { label: "Battery", value: "5000 mAh, 45W" },
    ],
    variants: [
      { label: "12GB / 256GB", price: 104500, mrp: 129999, stock: 6, modelNumber: "SM-S928B", prevPrice: 106000 },
      { label: "12GB / 512GB", price: 114500, mrp: 139999, stock: 3, modelNumber: "SM-S928B" },
      { label: "12GB / 1TB", price: 132000, mrp: 159999, stock: 1, modelNumber: "SM-S928B" },
    ],
  },
  {
    name: "Apple iPhone 16",
    brand: "Apple",
    category: "Mobiles",
    variants: [
      { label: "128GB", price: 68900, mrp: 79900, stock: 8 },
      { label: "256GB", price: 78400, mrp: 89900, stock: 4 },
    ],
  },
  {
    name: "Redmi Note 14 Pro 5G",
    brand: "Redmi",
    category: "Mobiles",
    variants: [
      { label: "8GB / 128GB", price: 21800, mrp: 24999, stock: 20 },
      { label: "8GB / 256GB", price: 23600, mrp: 26999, stock: 12 },
    ],
  },
  {
    name: "Vivo T3 5G",
    brand: "Vivo",
    category: "Mobiles",
    variants: [{ label: "8GB / 128GB", price: 17200, mrp: 19999, stock: 0 }],
  },
  {
    name: "Samsung 43 inch Crystal 4K Smart TV",
    brand: "Samsung",
    category: "Smart TVs",
    specs: [
      { label: "Screen Size", value: '43" (108 cm)' },
      { label: "Resolution", value: "4K Ultra HD (3840 x 2160)" },
      { label: "Smart OS", value: "Tizen" },
    ],
    variants: [{ label: "", price: 27400, mrp: 41900, stock: 5, modelNumber: "UA43DUE70BKLXL" }],
  },
  {
    name: "LG 28L Convection Microwave Oven",
    brand: "LG",
    category: "Microwave Ovens",
    variants: [{ label: "", price: 13200, mrp: 18990, stock: 7, modelNumber: "MC2846BG" }],
  },
  {
    name: "boAt Airdopes 141",
    brand: "boAt",
    category: "Audio & Speakers",
    variants: [{ label: "", price: 899, mrp: 4490, stock: 150, prevPrice: 949 }],
  },
  {
    name: "Samsung 25W USB-C Fast Charger",
    brand: "Samsung",
    category: "Accessories",
    variants: [{ label: "", price: 899, mrp: 1699, stock: 80 }],
  },
];

export const DEMO_PRODUCT_NAMES = DEMO_PRODUCTS.map((p) => p.name);
export const DEMO_RETAILER_PHONE = "8888888888";
export const DEMO_ADMIN_PHONE = "9999999999";

/** Creates default data the first time. Safe to run many times. */
export async function seed(
  db: DB,
  opts: { demo: boolean; adminPhone?: string; adminPassword?: string },
) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users);
  if (count > 0) return;

  await db.insert(users).values({
    name: "Mama",
    shopName: "Laxmi Associates",
    phone: opts.adminPhone ?? "9999999999",
    passwordHash: await hashPassword(opts.adminPassword ?? "mama1234"),
    role: "admin",
    status: "approved",
  });

  const cats = await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
    .returning();

  await db
    .insert(settings)
    .values([
      { key: "shopName", value: "Laxmi Associates" },
      { key: "upiName", value: "Laxmi Associates" },
    ])
    .onConflictDoNothing();

  if (!opts.demo) return;

  await db.insert(users).values({
    name: "Ramesh Kumar",
    shopName: "Ramesh Mobile Point",
    phone: "8888888888",
    passwordHash: await hashPassword("shop1234"),
    city: "Indore",
    address: "12, MG Road, Indore",
    status: "approved",
  });

  const catId = new Map(cats.map((c) => [c.name, c.id]));
  for (const p of DEMO_PRODUCTS) {
    const [row] = await db
      .insert(products)
      .values({
        name: p.name,
        brand: p.brand,
        categoryId: catId.get(p.category) ?? null,
        description: p.description ?? "",
        specs: p.specs ?? [],
        moq: p.moq ?? 1,
      })
      .returning({ id: products.id });
    await db.insert(variants).values(
      p.variants.map((v, i) => ({
        productId: row.id,
        label: v.label,
        price: v.price,
        mrp: v.mrp ?? null,
        stock: v.stock,
        modelNumber: v.modelNumber ?? "",
        prevPrice: v.prevPrice ?? null,
        sortOrder: i,
      })),
    );
  }
}
