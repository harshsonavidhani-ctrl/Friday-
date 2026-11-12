import { ArrowRight, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { CartQty } from "@/components/shop/CartControls";
import { canSeePrices, requireUser } from "@/lib/auth";
import { getCart, getMaxQty } from "@/lib/cart";
import { formatINR } from "@/lib/format";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await requireUser("/cart");
  const t = await getT();
  if (!canSeePrices(user)) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="font-semibold text-slate-800">{t("Your shop is waiting for approval")}</p>
        <p className="mt-1 text-sm text-slate-500">{t("You can order as soon as it is approved.")}</p>
      </div>
    );
  }
  const [lines, maxQty] = await Promise.all([getCart(user.id), getMaxQty()]);
  if (!lines.length) {
    return (
      <div className="card mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <ShoppingCart className="size-10 text-slate-300" />
        <p className="font-semibold text-slate-800">{t("Your cart is empty")}</p>
        <Link href="/products" className="btn btn-primary">
          {t("Browse products")}
        </Link>
      </div>
    );
  }
  const subtotal = lines.reduce((x, l) => x + l.price * l.qty, 0);
  const pieces = lines.reduce((x, l) => x + l.qty, 0);
  const hasProblem = lines.some((l) => l.problem);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{t("Your cart")}</h1>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ul className="card divide-y divide-slate-100">
          {lines.map((l) => (
            <li key={l.variantId} className="flex gap-3 p-3 sm:p-4">
              <Link href={`/p/${l.productId}`} className="shrink-0">
                <ProductImage src={l.image} alt={l.name} className="size-20 rounded-xl ring-1 ring-slate-100" />
              </Link>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Link href={`/p/${l.productId}`} className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-brand-800">
                  {l.name}
                </Link>
                {(l.label || l.kind === "activated") && (
                  <p className="text-xs text-slate-500">
                    {l.label}
                    {l.kind === "activated" && <span className="ml-1 rounded bg-gold-500 px-1 text-[10px] font-bold text-white uppercase">{t("Activated")}</span>}
                  </p>
                )}
                <p className="num text-sm text-slate-600">
                  {formatINR(l.price)} × {l.qty} = <b className="text-slate-900">{formatINR(l.price * l.qty)}</b>
                </p>
                {l.problem && (
                  <p className="text-xs font-semibold text-rose-600">
                    {t(l.problem.text, l.problem.vars)} — {t("please change quantity")}
                  </p>
                )}
                <CartQty key={`${l.variantId}-${l.qty}`} variantId={l.variantId} qty={l.qty} moq={l.moq} stock={l.stock} maxQty={maxQty} />
              </div>
            </li>
          ))}
        </ul>

        <div className="card h-fit space-y-4 p-4 sm:p-5 lg:sticky lg:top-24">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>
                {t(lines.length === 1 ? "{n} item" : "{n} items", { n: lines.length })} · {t("{n} pcs", { n: pieces })}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-semibold text-slate-700">{t("Total")}</span>
              <span className="num text-2xl font-extrabold text-brand-950">{formatINR(subtotal)}</span>
            </div>
          </div>
          {hasProblem ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">{t("Fix the items above first")}</p>
          ) : (
            <Link href="/checkout" className="btn btn-success btn-lg w-full py-4 text-lg">
              {t("Checkout")} <ArrowRight className="size-5" />
            </Link>
          )}
          <p className="text-center text-xs text-slate-500">{t("Next: choose Cash or Online payment.")}</p>
        </div>
      </div>
    </div>
  );
}
