import { desc } from "drizzle-orm";
import { getDb, rateAliases, rateMessages } from "@/db";
import { getAllVariantsForAdmin } from "./admin-data";

/** Everything the Update Rates board needs (used on the dashboard and on /admin/rates). */
export async function getRatesStudioData() {
  const db = await getDb();
  const [rows, aliases, messages] = await Promise.all([
    getAllVariantsForAdmin(),
    db.select({ key: rateAliases.key, variantId: rateAliases.variantId }).from(rateAliases),
    db.select().from(rateMessages).orderBy(desc(rateMessages.createdAt), desc(rateMessages.id)).limit(30),
  ]);
  const current = messages.find((m) => m.isCurrent) ?? null;
  return {
    catalog: rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      name: r.name,
      brand: r.brand,
      label: r.label,
      kind: r.kind,
      price: r.price,
      stock: r.stock,
      isActive: r.isActive,
    })),
    aliases: Object.fromEntries(aliases.map((a) => [a.key, a.variantId])) as Record<string, number>,
    current: current ? { id: current.id, text: current.text, createdAt: new Date(current.createdAt).toISOString() } : null,
    history: messages.map((m) => ({
      id: m.id,
      kind: m.kind,
      isCurrent: m.isCurrent,
      applied: m.applied,
      changes: m.changes,
      createdAt: new Date(m.createdAt).toISOString(),
      preview: m.text.split("\n").find((l) => l.trim())?.slice(0, 40) ?? "",
    })),
  };
}
