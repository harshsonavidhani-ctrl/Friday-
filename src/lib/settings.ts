import { cache } from "react";
import { getDb, settings } from "@/db";

export const DEFAULT_SETTINGS = {
  shopName: "Laxmi Associates",
  tagline: "Mama's Wholesale Electronics",
  ownerName: "Mama",
  phone: "",
  whatsapp: "",
  address: "",
  city: "",
  gstin: "",
  upiId: "",
  upiName: "Laxmi Associates",
  /** Max amount per single UPI QR. Bigger amounts are split into parts. */
  upiLimit: "100000",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  /** "1" = retailers see exact pieces left, "0" = only In stock / Out of stock */
  showStockQty: "1",
  lowStockAt: "3",
  /** Highest quantity a retailer can pick for one item (dropdown 1…this). */
  maxQtyPerItem: "50",
  /** "1" = a placed order is confirmed at once (retailer sees "Order confirmed"); "0" = Mama confirms each one */
  autoConfirmOrders: "1",
  braveApiKey: "",
  serperApiKey: "",
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
export type Settings = Record<SettingKey, string>;
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

export const getSettings = cache(async (): Promise<Settings> => {
  const db = await getDb();
  const rows = await db.select().from(settings);
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in s) s[r.key as SettingKey] = r.value;
  }
  return s;
});

export async function saveSettings(values: Partial<Settings>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

/** Public-safe subset (never includes API keys). */
export function publicShopInfo(s: Settings) {
  return {
    shopName: s.shopName,
    tagline: s.tagline,
    ownerName: s.ownerName,
    phone: s.phone,
    whatsapp: s.whatsapp || s.phone,
    address: s.address,
    city: s.city,
    gstin: s.gstin,
  };
}
