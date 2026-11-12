"use client";

import { ArrowRight, Banknote, CalendarClock, Check, LoaderCircle, Minus, Plus, Smartphone, Store, Trash, Truck } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { placeOrder, setCartQty } from "@/app/actions/shop";
import { useT } from "@/components/LangProvider";
import { QtySelect } from "@/components/shop/BuyBox";
import { FormMessage, SubmitButton } from "@/components/ui";
import { formatINR } from "@/lib/format";

export function CartQty({
  variantId,
  qty,
  moq,
  stock,
  maxQty,
}: {
  variantId: number;
  qty: number;
  moq: number;
  stock: number;
  maxQty: number;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const min = Math.min(moq, maxQty);
  const max = Math.max(min, Math.min(stock, maxQty));
  const set = (n: number) => start(async () => void (await setCartQty(variantId, n)));
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center rounded-lg bg-white ring-1 ring-slate-300 ${pending ? "opacity-50" : ""}`}>
        <button
          type="button"
          className="p-2 disabled:opacity-30"
          disabled={pending || qty <= min}
          onClick={() => set(Math.min(max, qty - 1))}
          aria-label={t("Less")}
        >
          <Minus className="size-3.5" />
        </button>
        <QtySelect value={qty} min={min} max={max} onChange={(n) => n !== qty && set(n)} disabled={pending} />
        <button
          type="button"
          className="p-2 disabled:opacity-30"
          disabled={pending || qty >= max}
          onClick={() => set(qty + 1)}
          aria-label={t("More")}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        onClick={() => set(0)}
        disabled={pending}
        aria-label={t("Remove")}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash className="size-4" />}
      </button>
    </div>
  );
}

function Tick() {
  return (
    <span className="absolute top-2 right-2 rounded-full bg-gold-400 p-1 text-brand-950">
      <Check className="size-4" strokeWidth={3} />
    </span>
  );
}

type Pay = "cash" | "upi" | "credit";

/** Checkout: how to take the goods, then Cash or Online — the next screen is payment / "Order confirmed". */
export function CheckoutForm({
  defaultAddress,
  total,
  upiReady,
  ownerName,
}: {
  defaultAddress: string;
  total: number;
  upiReady: boolean;
  ownerName: string;
}) {
  const t = useT();
  const [state, action] = useActionState(placeOrder, undefined);
  const [method, setMethod] = useState<"pickup" | "parcel">("pickup");
  const [pay, setPay] = useState<Pay>("upi");

  const big = (on: boolean) =>
    `relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center select-none ring-inset active:scale-[0.97] ${
      on ? "bg-brand-900 text-white shadow-lg ring-2 ring-brand-900" : "bg-white text-slate-800 ring-2 ring-slate-200"
    }`;

  return (
    <form action={action} className="space-y-5">
      {/* "Online" without a UPI ID yet → bank transfer details on the payment page */}
      <input type="hidden" name="payPlan" value={pay === "upi" && !upiReady ? "bank" : pay} />
      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg font-extrabold text-brand-950">{t("1. How will you take the goods?")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: "pickup", label: t("Pickup from shop"), icon: Store },
              { v: "parcel", label: t("Send parcel"), icon: Truck },
            ] as const
          ).map(({ v, label, icon: Icon }) => (
            <label key={v} className={big(method === v)}>
              <input type="radio" name="deliveryMethod" value={v} checked={method === v} onChange={() => setMethod(v)} className="sr-only" />
              {method === v && <Tick />}
              <Icon className="size-7" />
              <span className="text-base font-bold">{label}</span>
            </label>
          ))}
        </div>
        {method === "parcel" && (
          <div>
            <label className="label" htmlFor="address">
              {t("Parcel address & transport name")}
            </label>
            <textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={defaultAddress}
              className="input"
              placeholder={t("Shop address, city, PIN — and your preferred transport / courier")}
              required
            />
            <p className="mt-1 text-xs text-slate-500">{t("Parcel / transport charges (if any) are added when your order is confirmed.")}</p>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg font-extrabold text-brand-950">{t("2. How will you pay?")}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className={big(pay === "cash")}>
            <input type="radio" name="pay" checked={pay === "cash"} onChange={() => setPay("cash")} className="sr-only" />
            {pay === "cash" && <Tick />}
            <Banknote className={`size-9 ${pay === "cash" ? "text-gold-300" : "text-emerald-600"}`} />
            <span className="text-xl font-black uppercase">{t("Cash")}</span>
            <span className={`text-xs ${pay === "cash" ? "text-white/75" : "text-slate-500"}`}>
              {method === "pickup" ? t("Pay when you collect") : t("Pay at the shop / on delivery")}
            </span>
          </label>
          <label className={big(pay === "upi")}>
            <input type="radio" name="pay" checked={pay === "upi"} onChange={() => setPay("upi")} className="sr-only" />
            {pay === "upi" && <Tick />}
            <Smartphone className={`size-9 ${pay === "upi" ? "text-gold-300" : "text-brand-700"}`} />
            <span className="text-xl font-black uppercase">{t("Online")}</span>
            <span className={`text-xs ${pay === "upi" ? "text-white/75" : "text-slate-500"}`}>{t("UPI QR · Bank transfer")}</span>
          </label>
        </div>
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-inset select-none ${
            pay === "credit" ? "bg-gold-50 ring-2 ring-gold-400" : "bg-white ring-1 ring-slate-200"
          }`}
        >
          <input type="radio" name="pay" checked={pay === "credit"} onChange={() => setPay("credit")} className="size-5 accent-gold-500" />
          <CalendarClock className="size-5 text-gold-700" />
          <span className="text-sm">
            <b className="text-slate-800">{t("Credit (udhaar)")}</b>
            <span className="block text-xs text-slate-500">{t("Pay later, if {name} agrees", { name: ownerName })}</span>
          </span>
        </label>
        {pay === "upi" && !upiReady && (
          <p className="rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-900">{t("The shop's UPI QR is not set up yet — you can pay by cash or bank.")}</p>
        )}
      </fieldset>

      <div>
        <label className="label" htmlFor="notes">
          {t("Note for the shop (optional)")}
        </label>
        <input id="notes" name="notes" className="input" placeholder={t("e.g. Need by Saturday, black colour only")} />
      </div>

      <div className="flex items-end justify-between rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
        <span className="font-bold text-slate-700">{t("Total")}</span>
        <span className="num text-2xl font-black text-brand-950">{formatINR(total)}</span>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-success btn-lg w-full py-4 text-lg" pendingText={t("Placing order…")}>
        {pay === "upi" ? (
          <>
            {t("Continue to payment")} <ArrowRight className="size-5" />
          </>
        ) : (
          <>
            <Check className="size-5" /> {t("Confirm order")}
          </>
        )}
      </SubmitButton>
    </form>
  );
}