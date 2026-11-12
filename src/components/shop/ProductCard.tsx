import { Lock, TrendingDown } from "lucide-react";
import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import type { ProductListItem } from "@/lib/catalog";
import { formatINR, marginPct } from "@/lib/format";
import { getT } from "@/lib/i18n-server";

export async function ProductCard({ p, showPrice, icon }: { p: ProductListItem; showPrice: boolean; icon?: string | null }) {
  const t = await getT();
  const margin = marginPct(p.minPrice, p.mrpAtMin);
  const out = p.stock <= 0;
  return (
    <Link
      href={`/p/${p.id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200"
    >
      <div className="relative">
        <ProductImage src={p.images[0]} alt={p.name} icon={icon} className={`aspect-square ${out ? "opacity-60" : ""}`} />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {p.isNew && <span className="badge bg-brand-900 text-white ring-brand-900">{t("New")}</span>}
          {showPrice && p.priceDrop && (
            <span className="badge bg-emerald-600 text-white ring-emerald-600">
              <TrendingDown className="size-3" /> {t("Price drop")}
            </span>
          )}
        </div>
        {out && (
          <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 py-1 text-center text-xs font-semibold text-white">{t("Out of stock")}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col border-t border-slate-100 p-3">
        {p.brand && <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">{p.brand}</p>}
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-slate-900 group-hover:text-brand-800">{p.name}</h3>
        {p.variantCount > 1 && <p className="mt-0.5 text-xs text-slate-500">{t("{n} variants", { n: p.variantCount })}</p>}
        <div className="mt-auto pt-2">
          {showPrice ? (
            <>
              <p className="num text-base font-extrabold text-brand-950">
                {p.minPrice !== p.maxPrice && <span className="text-xs font-medium text-slate-500">{t("from")} </span>}
                {formatINR(p.minPrice)}
              </p>
              {margin !== null && p.mrpAtMin && (
                <p className="num text-xs text-slate-500">
                  <s>{formatINR(p.mrpAtMin)}</s> <span className="font-semibold text-emerald-700">{t("{n}% margin", { n: margin })}</span>
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center gap-1 text-xs font-semibold text-gold-700">
              <Lock className="size-3.5" /> {t("Login to see price")}
            </p>
          )}
          {p.moq > 1 && <p className="mt-0.5 text-[11px] text-slate-500">{t("Min. order {n} pcs", { n: p.moq })}</p>}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}
