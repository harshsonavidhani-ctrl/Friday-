"use client";

import { ArrowDown, ArrowUp, Check, LoaderCircle, Minus, Plus, Search, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToCart } from "@/app/actions/shop";
import { useT } from "@/components/LangProvider";
import { formatINR } from "@/lib/format";
import type { BoardBrand, BoardPrice, BoardRow } from "@/lib/rate-board";

/**
 * Retailers' rate board: the same brand-wise list Mama updates, read-only —
 * they can only pick a quantity and add to cart.
 */
export function RateBoard({
  brands,
  inCart,
  cartCount,
  cartTotal,
  maxQty,
}: {
  brands: BoardBrand[];
  inCart: Record<number, number>;
  cartCount: number;
  cartTotal: number;
  maxQty: number;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok?: string; error?: string } | null>(null);

  const words = q
    .toLowerCase()
    .replace(/(\d{1,2})\s*[/+]\s*(\d{2,4})/g, "$1gb $2")
    .split(/\s+/)
    .filter(Boolean);
  const match = (r: BoardRow, b: string) => {
    if (!words.length) return true;
    const hay = `${b} ${r.name} ${r.label}`.toLowerCase();
    const toks = new Set(hay.split(/[^a-z0-9+]+/));
    // sizes must match exactly: "8gb" is not part of "128gb"
    return words.every((w) => (/^\d+gb$/.test(w) ? toks.has(w) : hay.includes(w) || hay.replace(/\s+/g, "").includes(w)));
  };
  const shown = brands
    .filter((b) => !brand || b.brand === brand)
    .map((b) => ({ ...b, rows: b.rows.filter((r) => match(r, b.brand)) }))
    .filter((b) => b.rows.length);
  const total = brands.reduce((s, b) => s + b.rows.length, 0);

  return (
    <div className="space-y-3 pb-24">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder={t("Search model… e.g. T5x 8/128")}
            className="w-full rounded-2xl border-2 border-brand-200 bg-white py-3.5 pr-4 pl-13 text-lg font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
            aria-label={t("Search model")}
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <BrandChip on={!brand} onClick={() => setBrand(null)}>
            {t("All")} {total}
          </BrandChip>
          {brands.map((b) => (
            <BrandChip key={b.brand} on={brand === b.brand} tone={b.color} onClick={() => setBrand(brand === b.brand ? null : b.brand)}>
              {b.brand}
            </BrandChip>
          ))}
        </div>
      </div>

      {toast && (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold ring-1 ${
            toast.error ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
          }`}
        >
          {!toast.error && <Check className="size-5" />} {toast.error ?? toast.ok}
        </p>
      )}

      {shown.map((b) => (
        <section key={b.brand} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: b.color }}>
            <span className="text-lg font-extrabold tracking-wide uppercase">{b.brand}</span>
            <span className="text-sm font-bold opacity-90">{b.rows.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {b.rows.map((r) => (
              <li key={r.key} className="space-y-2 border-l-[6px] px-3 py-3" style={{ borderLeftColor: b.color }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/p/${r.productId}`} className="text-lg leading-tight font-extrabold text-slate-900 hover:text-brand-800">
                    {r.name}
                  </Link>
                  {r.label && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700">{r.label}</span>}
                </div>
                {r.prices.map((p) => (
                  <PriceLine key={p.variantId} p={p} inCart={inCart[p.variantId] ?? 0} maxQty={maxQty} showKind={r.prices.length > 1 || p.kind === "activated"} onDone={setToast} />
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {shown.length === 0 && <p className="card p-8 text-center text-lg text-slate-500">{t("No model matches “{q}”.", { q })}</p>}

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <ShoppingCart className="size-6 shrink-0 text-brand-800" />
            <p className="num min-w-0 flex-1 text-base text-slate-700">
              <b className="text-slate-900">{t("{n} pcs", { n: cartCount })}</b> · <b className="text-lg text-brand-950">{formatINR(cartTotal)}</b>
            </p>
            <Link href="/checkout" className="btn btn-success btn-lg px-5 text-lg">
              {t("Checkout")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceLine({
  p,
  inCart,
  maxQty,
  showKind,
  onDone,
}: {
  p: BoardPrice;
  inCart: number;
  maxQty: number;
  showKind: boolean;
  onDone: (m: { ok?: string; error?: string }) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const diff = p.recent && p.prev ? p.price - p.prev : 0;

  const add = async () => {
    setBusy(true);
    try {
      const r = await addToCart(p.variantId, qty);
      onDone(r.error ? { error: t(r.error) } : { ok: r.ok });
      setQty(1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-2.5 ring-1 ${
        !p.inStock ? "bg-slate-50 ring-slate-200" : p.kind === "fresh" ? "bg-emerald-50/60 ring-emerald-200" : "bg-gold-50 ring-gold-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showKind && (
            <span className={`rounded-md px-2 py-0.5 text-xs font-extrabold tracking-wide text-white ${p.kind === "fresh" ? "bg-emerald-600" : "bg-gold-600"}`}>
              {p.kind === "fresh" ? t("FRESH") : t("ACTIVATED")}
            </span>
          )}
          <span className={`num text-2xl font-extrabold ${p.inStock ? "text-brand-950" : "text-slate-400 line-through"}`}>{formatINR(p.price)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-sm">
          {diff !== 0 && (
            <span className={`num inline-flex items-center gap-0.5 font-bold ${diff > 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {diff > 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
              {diff > 0 ? "+" : "−"}
              {formatINR(Math.abs(diff))} {t("today")}
            </span>
          )}
          {!p.inStock && <span className="font-bold text-rose-700">{t("Not available")}</span>}
          {inCart > 0 && <span className="font-semibold text-brand-700">{t("{n} in cart", { n: inCart })}</span>}
        </div>
      </div>
      {p.inStock && (
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-300">
            <button type="button" className="p-2.5 text-slate-600 disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label={t("Less")}>
              <Minus className="size-4" />
            </button>
            <span className="num w-8 text-center text-base font-bold">{qty}</span>
            <button type="button" className="p-2.5 text-slate-600 disabled:opacity-30" disabled={qty >= maxQty} onClick={() => setQty(qty + 1)} aria-label={t("More")}>
              <Plus className="size-4" />
            </button>
          </div>
          <button type="button" onClick={add} disabled={busy} className="btn btn-primary px-4 py-3 text-base">
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ShoppingCart className="size-5" />} {t("Add")}
          </button>
        </div>
      )}
    </div>
  );
}

function BrandChip({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-3.5 py-2 text-sm font-bold whitespace-nowrap ring-2"
      style={on ? { background: tone ?? "#1e2b80", color: "#fff", boxShadow: "none" } : { background: "#fff", color: tone ?? "#334155" }}
    >
      {children}
    </button>
  );
}
