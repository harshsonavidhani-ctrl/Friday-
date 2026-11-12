import { ChevronRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox, type BuyVariant } from "@/components/shop/BuyBox";
import { Gallery } from "@/components/shop/Gallery";
import { canSeePrices, getCurrentUser } from "@/lib/auth";
import { getProduct } from "@/lib/catalog";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct(Number((await params).id) || 0);
  return { title: p?.name ?? "Product" };
}

export default async function ProductPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [p, user, s, t] = await Promise.all([getProduct(id), getCurrentUser(), getSettings(), getT()]);
  const isAdmin = user?.role === "admin";
  if (!p || (!p.isActive && !isAdmin)) notFound();

  const approved = canSeePrices(user);
  const access = !user ? "guest" : approved ? "approved" : "pending";
  // Prices never leave the server for guests / unapproved shops.
  const variants: BuyVariant[] = p.variants.map((v) => ({
    id: v.id,
    label: v.label,
    kind: v.kind,
    modelNumber: v.modelNumber,
    stock: approved ? v.stock : v.stock > 0 ? 1 : 0,
    ...(approved
      ? {
          price: v.price,
          mrp: v.mrp,
          prevPrice: v.prevPrice,
          priceUpdatedAt: new Date(v.priceUpdatedAt).toISOString(),
        }
      : {}),
  }));

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link href="/products" className="hover:text-brand-800">
          {t("Products")}
        </Link>
        {p.category && (
          <>
            <ChevronRight className="size-4" />
            <Link href={`/products?cat=${p.category.id}`} className="hover:text-brand-800">
              {t(p.category.name)}
            </Link>
          </>
        )}
      </nav>

      {!p.isActive && (
        <p className="rounded-xl bg-gold-50 px-4 py-2.5 text-sm font-medium text-gold-900 ring-1 ring-gold-200">
          {t("This product is hidden from retailers.")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
        <Gallery images={p.images} name={p.name} icon={p.category?.icon} />
        <div className="space-y-5">
          <div>
            {p.brand && <p className="text-xs font-bold tracking-wider text-gold-700 uppercase">{p.brand}</p>}
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-brand-950 sm:text-3xl">
              {p.name}
            </h1>
            {isAdmin && (
              <Link href={`/admin/products/${p.id}`} className="btn btn-gold btn-sm mt-2">
                <Pencil className="size-4" /> {t("Edit this product")}
              </Link>
            )}
          </div>
          <BuyBox
            productId={p.id}
            name={p.name}
            moq={p.moq}
            variants={variants}
            access={access}
            showStockQty={s.showStockQty === "1"}
            whatsapp={s.whatsapp || s.phone}
            maxQty={Number(s.maxQtyPerItem) || 50}
          />
        </div>
      </div>

      {(p.description || p.specs.length > 0) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
          {p.specs.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="border-b border-slate-100 px-5 py-3 font-bold text-brand-950">{t("Specifications")}</h2>
              <dl className="divide-y divide-slate-100 text-sm">
                {p.specs.map((sp) => (
                  <div key={sp.label} className="grid grid-cols-[40%_1fr] gap-3 px-5 py-2.5">
                    <dt className="text-slate-500">{t(sp.label)}</dt>
                    <dd className="font-medium text-slate-900">{sp.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {p.description && (
            <section className="card p-5">
              <h2 className="mb-2 font-bold text-brand-950">{t("Details")}</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{p.description}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
