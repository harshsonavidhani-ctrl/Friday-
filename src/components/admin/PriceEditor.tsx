"use client";

import { Check, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { bulkUpdateVariants, type VariantChange } from "@/app/actions/admin";
import { useT } from "@/components/LangProvider";
import { ProductImage } from "@/components/ProductImage";
import { formatINR, relativeDay } from "@/lib/format";

export type PriceRow = {
  id: number;
  productId: number;
  name: string;
  brand: string;
  image: string | null;
  categoryId: number | null;
  categoryName: string | null;
  isActive: boolean;
  label: string;
  kind: "fresh" | "activated";
  modelNumber: string;
  price: number;
  mrp: number | null;
  stock: number;
  priceUpdatedAt: string;
};

type Edit = { price?: string; stock?: string; mrp?: string };

export function PriceEditor({ rows, cats }: { rows: PriceRow[]; cats: { id: number; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<number | "">("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [showMrp, setShowMrp] = useState(false);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  const visible = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (cat && r.categoryId !== cat) return false;
      if (onlyLow && r.stock > 3) return false;
      const hay = `${r.name} ${r.brand} ${r.label} ${r.modelNumber}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [rows, q, cat, onlyLow]);

  const changes: VariantChange[] = useMemo(() => {
    const out: VariantChange[] = [];
    for (const r of rows) {
      const e = edits[r.id];
      if (!e) continue;
      const c: VariantChange = { id: r.id };
      if (e.price !== undefined && Number(e.price) !== r.price) c.price = Number(e.price);
      if (e.stock !== undefined && Number(e.stock || 0) !== r.stock) c.stock = Number(e.stock || 0);
      if (e.mrp !== undefined && (Number(e.mrp) || null) !== r.mrp) c.mrp = Number(e.mrp) || null;
      if (Object.keys(c).length > 1) out.push(c);
    }
    return out;
  }, [edits, rows]);

  const set = (id: number, patch: Edit) => {
    setMsg(null);
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  };

  function save() {
    if (changes.some((c) => c.price !== undefined && !(c.price > 0))) {
      setMsg({ error: t("A price is empty — please fill it") });
      return;
    }
    start(async () => {
      const r = await bulkUpdateVariants(changes);
      if (!r.ok) return setMsg({ error: t(r.error) });
      setEdits({});
      setMsg({ ok: t("Saved {n} change(s) — the shop shows new rates now", { n: r.count }) });
      router.refresh();
    });
  }

  // group by product for a clean list
  const groups: { productId: number; rows: PriceRow[] }[] = [];
  for (const r of visible) {
    const last = groups[groups.length - 1];
    if (last && last.productId === r.productId) last.rows.push(r);
    else groups.push({ productId: r.productId, rows: [r] });
  }

  return (
    <div className="space-y-3 pb-24">
      <div className="card sticky top-[64px] z-20 space-y-2 p-3 lg:top-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find model…")} className="input pl-10" type="search" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={cat} onChange={(e) => setCat(Number(e.target.value) || "")} className="input w-auto py-1.5 text-sm">
            <option value="">{t("All categories")}</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.name)}
              </option>
            ))}
          </select>
          <label className="chip cursor-pointer text-xs">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="size-4 accent-brand-800" />
            {t("Low stock only")}
          </label>
          <label className="chip cursor-pointer text-xs">
            <input type="checkbox" checked={showMrp} onChange={(e) => setShowMrp(e.target.checked)} className="size-4 accent-brand-800" />
            {t("Edit MRP too")}
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((g) => {
          const head = g.rows[0];
          return (
            <div key={g.productId} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2">
                <ProductImage src={head.image} alt="" className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {head.name}
                    {!head.isActive && <span className="ml-1.5 text-xs font-medium text-slate-400">({t("hidden")})</span>}
                  </p>
                  <p className="text-[11px] text-slate-500">{t("Rate updated {when}", { when: relativeDay(head.priceUpdatedAt) })}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {g.rows.map((r) => {
                  const e = edits[r.id] ?? {};
                  const price = e.price ?? String(r.price);
                  const stock = e.stock ?? String(r.stock);
                  const mrp = e.mrp ?? (r.mrp ? String(r.mrp) : "");
                  const changed = changes.some((c) => c.id === r.id);
                  const diff = Number(price) - r.price;
                  return (
                    <div key={r.id} className={`grid items-end gap-2 px-3 py-2.5 ${showMrp ? "grid-cols-[1fr_96px_84px_64px]" : "grid-cols-[1fr_110px_72px]"} ${changed ? "bg-gold-50" : ""}`}>
                      <div className="min-w-0 self-center">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {r.label || t("Standard")}
                          {r.kind === "activated" && <span className="ml-1 rounded bg-gold-500 px-1 text-[10px] font-bold text-white uppercase">{t("Activated")}</span>}
                        </p>
                        {changed && diff !== 0 && (
                          <p className={`num text-[11px] font-semibold ${diff > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            {diff < 0 ? "▼" : "▲"} {formatINR(Math.abs(diff))} ({t("was {amount}", { amount: formatINR(r.price) })})
                          </p>
                        )}
                      </div>
                      <Cell label={t("Rate ₹")} value={price} onChange={(v) => set(r.id, { price: v })} strong />
                      {showMrp && <Cell label={t("MRP ₹")} value={mrp} onChange={(v) => set(r.id, { mrp: v })} />}
                      <Cell
                        label={t("Pcs")}
                        value={stock}
                        onChange={(v) => set(r.id, { stock: v })}
                        danger={Number(stock) <= 0}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && <p className="card p-8 text-center text-sm text-slate-500">{t("Nothing matches.")}</p>}
      </div>

      <div className="no-print fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[260px]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {msg?.error ? (
              <p className="font-semibold text-rose-600">{msg.error}</p>
            ) : msg?.ok ? (
              <p className="flex items-center gap-1 font-semibold text-emerald-700">
                <Check className="size-4 shrink-0" /> {msg.ok}
              </p>
            ) : (
              <p className="text-slate-500">
                {changes.length ? t("{n} unsaved change(s)", { n: changes.length }) : t("Tap a rate or stock to change it")}
              </p>
            )}
          </div>
          {changes.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setEdits({})} disabled={pending}>
              <RotateCcw className="size-4" /> {t("Undo")}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={save} disabled={pending || !changes.length}>
            {pending ? <LoaderCircle className="size-5 animate-spin" /> : <Check className="size-5" />}
            {t("Save")}{changes.length ? ` ${changes.length}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, onChange, strong, danger }: { label: string; value: string; onChange: (v: string) => void; strong?: boolean; danger?: boolean }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-semibold text-slate-500">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.target.select()}
        className={`num w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-right text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none ${
          strong ? "font-bold text-brand-950" : ""
        } ${danger ? "border-rose-300 text-rose-600" : ""}`}
      />
    </label>
  );
}
