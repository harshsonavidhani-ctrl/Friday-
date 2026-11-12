"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/components/LangProvider";

type Current = { q: string; cat: number | null; brand: string; stock: boolean; sort: string };

export function FilterBar({
  cats,
  brands,
  current,
  allowPriceSort,
}: {
  cats: { id: number; name: string; count: number }[];
  brands: string[];
  current: Current;
  allowPriceSort: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  function go(patch: Partial<Current>) {
    const next = { ...current, ...patch };
    const sp = new URLSearchParams();
    if (next.q) sp.set("q", next.q);
    if (next.cat) sp.set("cat", String(next.cat));
    if (next.brand) sp.set("brand", next.brand);
    if (next.stock) sp.set("stock", "1");
    if (next.sort && next.sort !== "new") sp.set("sort", next.sort);
    start(() => router.push(`/products${sp.size ? `?${sp}` : ""}`));
  }

  return (
    <div className={`space-y-3 transition ${pending ? "opacity-60" : ""}`}>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button type="button" onClick={() => go({ cat: null })} className={`chip ${!current.cat ? "chip-active" : ""}`}>
          {t("All")}
        </button>
        {cats
          .filter((c) => c.count > 0)
          .map((c) => (
            <button key={c.id} type="button" onClick={() => go({ cat: c.id })} className={`chip ${current.cat === c.id ? "chip-active" : ""}`}>
              {c.name}
            </button>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t("Brand")} className="input w-auto py-2 pr-8 text-sm" value={current.brand} onChange={(e) => go({ brand: e.target.value })}>
          <option value="">{t("All brands")}</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select aria-label={t("Sort")} className="input w-auto py-2 pr-8 text-sm" value={current.sort} onChange={(e) => go({ sort: e.target.value })}>
          <option value="new">{t("Newest first")}</option>
          {allowPriceSort && <option value="price_asc">{t("Price: low to high")}</option>}
          {allowPriceSort && <option value="price_desc">{t("Price: high to low")}</option>}
          <option value="name">{t("Name A–Z")}</option>
        </select>
        <label className="chip cursor-pointer">
          <input type="checkbox" className="size-4 accent-brand-800" checked={current.stock} onChange={(e) => go({ stock: e.target.checked })} />
          {t("In stock only")}
        </label>
        {(current.q || current.brand || current.stock || current.cat) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ q: "", brand: "", stock: false, cat: null, sort: "new" })}>
            <X className="size-4" /> {t("Clear")}
          </button>
        )}
      </div>
    </div>
  );
}
