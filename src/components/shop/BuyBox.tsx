"use client";

import { Check, LoaderCircle, Lock, MessageCircle, Minus, Plus, Share2, ShoppingCart, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/shop";
import { useT } from "@/components/LangProvider";
import { formatINR, marginPct, relativeDay, waLink } from "@/lib/format";

/** Quantity dropdown: tap to pick any number from min to max (e.g. 1–50). */
export function QtySelect({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const options: number[] = [];
  for (let n = Math.min(min, value); n <= Math.max(max, value); n++) options.push(n);
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="num w-16 cursor-pointer appearance-none border-0 bg-transparent py-2 text-center text-base font-bold [text-align-last:center] focus:outline-none disabled:opacity-50"
      aria-label={t("Quantity")}
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

export type BuyVariant = {
  id: number;
  label: string;
  kind: "fresh" | "activated";
  modelNumber: string;
  stock: number;
  price?: number;
  mrp?: number | null;
  prevPrice?: number | null;
  priceUpdatedAt?: string;
};

export function BuyBox({
  productId,
  name,
  moq,
  variants,
  access,
  showStockQty,
  whatsapp,
  maxQty,
}: {
  productId: number;
  name: string;
  moq: number;
  variants: BuyVariant[];
  access: "guest" | "pending" | "approved";
  showStockQty: boolean;
  whatsapp: string;
  maxQty: number;
}) {
  const t = useT();
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [vid, setVid] = useState(firstInStock?.id);
  const v = variants.find((x) => x.id === vid) ?? variants[0];
  const [qty, setQty] = useState(moq);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  if (!v) return null;
  const out = v.stock <= 0;
  const min = Math.min(moq, maxQty);
  const max = Math.max(min, Math.min(v.stock, maxQty));
  const q = Math.min(max, Math.max(min, qty)); // stays valid when switching variants
  const margin = v.price ? marginPct(v.price, v.mrp) : null;
  const dropped = v.price && v.prevPrice && v.prevPrice > v.price ? v.prevPrice - v.price : 0;
  const showVariants = variants.length > 1 || !!variants[0]?.label;
  const hasBoth = variants.some((x) => x.kind === "activated") && variants.some((x) => x.kind === "fresh");
  const fullName = `${name}${v.label ? ` (${v.label})` : ""}${v.kind === "activated" ? " — Activated" : hasBoth ? " — Fresh" : ""}`;

  function add() {
    setMsg(null);
    start(async () => setMsg(await addToCart(v.id, q)));
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
      } catch {}
    } else {
      window.open(waLink("", `${name}\n${url}`), "_blank");
    }
  }

  return (
    <div className="space-y-5">
      {showVariants && (
        <div>
          <p className="label">{t("Choose variant")}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setVid(x.id);
                  setMsg(null);
                }}
                className={`rounded-xl px-3.5 py-2 text-left ring-1 transition ring-inset ${
                  x.id === v.id
                    ? "bg-brand-50 ring-2 ring-brand-600"
                    : "bg-white ring-slate-300 hover:ring-slate-400"
                } ${x.stock <= 0 ? "opacity-60" : ""}`}
              >
                <span className="block text-sm font-semibold text-slate-900">{x.label || t("Standard")}</span>
                {x.kind === "activated" ? (
                  <span className="mt-0.5 inline-block rounded bg-gold-500 px-1.5 text-[10px] font-extrabold tracking-wide text-white uppercase">{t("Activated")}</span>
                ) : (
                  hasBoth && (
                    <span className="mt-0.5 inline-block rounded bg-emerald-600 px-1.5 text-[10px] font-extrabold tracking-wide text-white uppercase">{t("Fresh")}</span>
                  )
                )}
                {x.price !== undefined && (
                  <span className="num block text-xs text-slate-600">{formatINR(x.price)}</span>
                )}
                {x.stock <= 0 && <span className="block text-[11px] font-semibold text-rose-600">{t("Out of stock")}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {access === "approved" && v.price !== undefined ? (
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t("Wholesale rate")}
            {v.kind === "activated" ? ` · ${t("Activated")}` : hasBoth ? ` · ${t("Fresh")}` : ""}
          </p>
          <p className="num text-3xl font-extrabold text-brand-950">{formatINR(v.price)}</p>
          <div className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {v.mrp && (
              <span className="text-slate-500">
                {t("MRP")} <s>{formatINR(v.mrp)}</s>
              </span>
            )}
            {margin !== null && v.mrp && (
              <span className="font-semibold text-emerald-700">
                {t("Your margin {amount} ({n}%)", { amount: formatINR(v.mrp - v.price), n: margin })}
              </span>
            )}
            {dropped > 0 && (
              <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
                <TrendingDown className="size-3" /> {t("{amount} cheaper", { amount: formatINR(dropped) })}
              </span>
            )}
          </div>
          {v.priceUpdatedAt && (
            <p className="mt-2 text-xs text-slate-500">{t("Rate updated {when}", { when: relativeDay(v.priceUpdatedAt) })}</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-200">
          <p className="flex items-center gap-2 font-semibold text-gold-900">
            <Lock className="size-4" />
            {access === "pending" ? t("Rates unlock after your shop is approved") : t("Wholesale rates are for registered retailers")}
          </p>
          {access === "guest" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/login?next=/p/${productId}`} className="btn btn-primary">
                {t("Login to see price")}
              </Link>
              <Link href="/register" className="btn btn-outline">
                {t("Register shop")}
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={`font-semibold ${out ? "text-rose-600" : "text-emerald-700"}`}>
          {out
            ? t("Out of stock")
            : showStockQty && access === "approved"
              ? t("{n} pcs available", { n: v.stock })
              : t("In stock")}
        </span>
        {moq > 1 && <span className="text-slate-600">{t("Minimum order: {n} pcs", { n: moq })}</span>}
        {v.modelNumber && <span className="text-slate-500">{t("Model no")}: {v.modelNumber}</span>}
      </div>

      {access === "approved" && !out && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-300">
            <button
              type="button"
              className="p-3 text-slate-600 disabled:opacity-30"
              onClick={() => setQty(Math.max(min, q - 1))}
              disabled={q <= min}
              aria-label={t("Less")}
            >
              <Minus className="size-4" />
            </button>
            <QtySelect value={q} min={min} max={max} onChange={setQty} />
            <button
              type="button"
              className="p-3 text-slate-600 disabled:opacity-30"
              onClick={() => setQty(Math.min(max, q + 1))}
              disabled={q >= max}
              aria-label={t("More")}
            >
              <Plus className="size-4" />
            </button>
          </div>
          <button type="button" onClick={add} disabled={pending} className="btn btn-primary btn-lg flex-1 sm:flex-none">
            {pending ? <LoaderCircle className="size-5 animate-spin" /> : <ShoppingCart className="size-5" />}
            {t("Add to cart")}
          </button>
          {v.price !== undefined && (
            <p className="num w-full text-sm text-slate-600">
              {q} × {formatINR(v.price)} = <b className="text-slate-900">{formatINR(q * v.price)}</b>
              {max < maxQty && !out && <span className="text-slate-400"> · {t("max {n} available", { n: max })}</span>}
            </p>
          )}
        </div>
      )}

      {msg && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium ring-1 ${
            msg.error ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {!msg.error && <Check className="size-4" />}
            {msg.error ? t(msg.error) : msg.ok}
          </span>
          {!msg.error && (
            <Link href="/cart" className="btn btn-success btn-sm">
              {t("View cart")}
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {whatsapp && (
          <a
            href={waLink(whatsapp, `Hello, I want to ask about: ${fullName}`)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
          >
            <MessageCircle className="size-4 text-[#1fa855]" /> {t("Ask on WhatsApp")}
          </a>
        )}
        <button type="button" onClick={share} className="btn btn-outline btn-sm">
          <Share2 className="size-4" /> {t("Share")}
        </button>
      </div>
    </div>
  );
}
