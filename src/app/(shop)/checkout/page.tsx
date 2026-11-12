import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductImage } from "@/components/ProductImage";
import { CheckoutForm } from "@/components/shop/CartControls";
import { requireApproved } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { formatINR } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Checkout" };

/** Cart → Checkout (delivery + Cash / Online) → payment page or "Order confirmed". */
export default async function CheckoutPage() {
  const user = await requireApproved("/checkout");
  const [lines, s, t] = await Promise.all([getCart(user.id), getSettings(), getT()]);
  if (!lines.length || lines.some((l) => l.problem)) redirect("/cart");
  const total = lines.reduce((x, l) => x + l.price * l.qty, 0);
  const pieces = lines.reduce((x, l) => x + l.qty, 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/cart" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-800">
        <ArrowLeft className="size-4" /> {t("Cart")}
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Checkout")}</h1>

      <details className="card overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
          <span className="font-bold text-slate-800">{t("{n} pcs", { n: pieces })}</span>
          <span className="num text-lg font-extrabold text-brand-950">{formatINR(total)}</span>
        </summary>
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {lines.map((l) => (
            <li key={l.variantId} className="flex items-center gap-3 px-4 py-2">
              <ProductImage src={l.image} alt={l.name} className="size-10 shrink-0 rounded-lg ring-1 ring-slate-100" />
              <span className="min-w-0 flex-1 text-sm">
                <b className="text-slate-900">{l.name}</b> <span className="text-slate-500">{l.label}</span>
                {l.kind === "activated" && <span className="ml-1 rounded bg-gold-500 px-1 text-[10px] font-bold text-white uppercase">{t("Activated")}</span>}
              </span>
              <span className="num text-sm text-slate-600">
                {l.qty} × {formatINR(l.price)}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <div className="card p-4 sm:p-5">
        <CheckoutForm
          defaultAddress={
            user.city && !user.address.toLowerCase().includes(user.city.toLowerCase())
              ? [user.address, user.city].filter(Boolean).join(", ")
              : user.address
          }
          total={total}
          upiReady={!!s.upiId}
          ownerName={s.ownerName}
        />
      </div>
    </div>
  );
}
