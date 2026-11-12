import type { Metadata } from "next";
import { RateList } from "@/components/admin/RateList";
import { getAllVariantsForAdmin } from "@/lib/admin-data";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Share rate list" };

export default async function RateListPage() {
  const [rows, s, base, t] = await Promise.all([getAllVariantsForAdmin(), getSettings(), siteUrl(), getT()]);
  const live = rows.filter((r) => r.isActive);
  const cats = new Map<number, string>();
  for (const r of live) if (r.categoryId && r.categoryName) cats.set(r.categoryId, r.categoryName);
  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Share today's rate list")}</h1>
        <p className="text-sm text-slate-500">{t("Makes a ready WhatsApp message with all current rates. Edit it if you like, then send.")}</p>
      </div>
      <RateList
        rows={live.map((r) => ({
          id: r.id,
          name: r.name,
          label: r.kind === "activated" ? [r.label, "Activated"].filter(Boolean).join(" ") : r.label,
          price: r.price,
          mrp: r.mrp,
          stock: r.stock,
          categoryId: r.categoryId,
          categoryName: r.categoryName,
        }))}
        cats={[...cats].map(([id, name]) => ({ id, name }))}
        shopName={s.shopName}
        phone={s.whatsapp || s.phone}
        site={base}
      />
    </div>
  );
}
