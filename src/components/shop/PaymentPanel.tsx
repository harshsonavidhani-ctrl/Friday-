"use client";

import { Banknote, Building, Check, LoaderCircle, QrCode, Settings, Smartphone, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useActionState, useEffect, useState } from "react";
import { submitPayment } from "@/app/actions/shop";
import { useT } from "@/components/LangProvider";
import { CopyButton, FormMessage, SubmitButton } from "@/components/ui";
import { formatINR } from "@/lib/format";
import { splitAmount, upiLink } from "@/lib/upi";

type Bank = { name: string; accountName: string; accountNumber: string; ifsc: string };
export type PayMode = "upi" | "bank" | "cash";

const MODES: { v: PayMode; label: string; icon: LucideIcon }[] = [
  { v: "upi", label: "UPI QR", icon: QrCode },
  { v: "bank", label: "Bank", icon: Building },
  { v: "cash", label: "Cash", icon: Banknote },
];

export function PaymentPanel({
  orderId,
  orderNo,
  balance,
  upiId,
  upiName,
  upiLimit,
  bank,
  defaultMode = "upi",
  deliveryMethod,
  isAdmin = false,
  ownerName = "Mama",
  doneHref,
}: {
  orderId: number;
  orderNo: string;
  balance: number;
  upiId: string;
  upiName: string;
  upiLimit: number;
  bank: Bank;
  defaultMode?: PayMode;
  deliveryMethod: "pickup" | "parcel";
  isAdmin?: boolean;
  ownerName?: string;
  /** after "I have paid" go here (the "Order confirmed" screen) */
  doneHref?: string;
}) {
  const t = useT();
  const router = useRouter();
  const parts = splitAmount(balance, upiLimit);
  const [mode, setMode] = useState<PayMode>(defaultMode);
  const [amount, setAmount] = useState(parts[0]);
  const [raw, setRaw] = useState(String(parts[0]));
  const [qrImg, setQrImg] = useState<{ link: string; data: string } | null>(null);
  const [state, action] = useActionState(submitPayment, undefined);
  useEffect(() => {
    if (state?.ok && doneHref) router.replace(doneHref);
  }, [state, doneHref, router]);
  const hasBank = !!(bank.accountNumber && bank.ifsc);

  // The QR always carries the exact amount; it is redrawn whenever it changes.
  const link =
    mode === "upi" && upiId && amount > 0 ? upiLink({ upiId, name: upiName, amount, note: `Order ${orderNo}` }) : "";
  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toDataURL(link, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#121a4b" } }).then(
      (data) => alive && setQrImg({ link, data }),
    );
    return () => {
      alive = false;
    };
  }, [link]);
  const qr = qrImg && qrImg.link === link ? qrImg.data : null;

  function pick(n: number) {
    const v = Math.max(1, Math.min(balance, Math.round(n)));
    setAmount(v);
    setRaw(String(v));
  }

  const notSetUp = (what: string) => (
    <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
      <p>
        {t("{what} is not set up by the shop yet. Please pay by another option, or call the shop.", { what })}
      </p>
      {isAdmin && (
        <Link href="/admin/settings#payments" className="btn btn-gold btn-sm">
          <Settings className="size-4" /> {t("Admin: add it in Settings → Payments")}
        </Link>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Big, clearly tappable choices */}
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={t("Payment method")}>
        {MODES.map(({ v, label, icon: Icon }) => {
          const on = mode === v;
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setMode(v)}
              className={`relative flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-bold ring-1 ring-inset active:scale-[0.97] ${
                on ? "bg-brand-900 text-white ring-brand-900 shadow-md" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {on && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-gold-400 p-0.5 text-brand-950">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
              <Icon className="size-6" />
              {t(label)}
            </button>
          );
        })}
      </div>

      {mode === "upi" &&
        (!upiId ? (
          notSetUp(t("UPI QR"))
        ) : (
          <div className="space-y-4">
            {parts.length > 1 && (
              <div className="rounded-xl bg-gold-50 p-3 text-sm text-gold-900 ring-1 ring-gold-200">
                <p className="font-semibold">
                  {t("UPI allows up to {amount} per payment, so pay in {n} parts:", { amount: formatINR(upiLimit), n: parts.length })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {parts.map((p, i) => (
                    <button key={i} type="button" onClick={() => pick(p)} className={`chip num ${amount === p ? "chip-active" : ""}`}>
                      {t("Part {n}", { n: i + 1 })}: {formatINR(p)}
                    </button>
                  ))}
                </div>
                {hasBank && <p className="mt-2 text-xs">{t("Or choose Bank (RTGS) to pay it all at once.")}</p>}
              </div>
            )}

            <div>
              <label className="label" htmlFor="pay-amount">
                {t("Amount to pay now")}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500">₹</span>
                  <input
                    id="pay-amount"
                    inputMode="numeric"
                    className="input num pl-8 text-lg font-bold"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value.replace(/\D/g, ""))}
                    onBlur={() => pick(Number(raw) || parts[0])}
                  />
                </div>
                {amount !== balance && balance <= upiLimit && (
                  <button type="button" className="btn btn-outline" onClick={() => pick(balance)}>
                    {t("Full")}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex aspect-square w-full max-w-[260px] items-center justify-center">
                {qr ? (
                  <img src={qr} alt={t("UPI QR for {amount}", { amount: formatINR(amount) })} className="size-full" />
                ) : (
                  <LoaderCircle className="size-8 animate-spin text-slate-300" />
                )}
              </div>
              <p className="num text-center text-2xl font-extrabold text-brand-950">{formatINR(amount)}</p>
              <p className="text-center text-xs text-slate-500">
                {t("Scan with GPay, PhonePe, Paytm or any UPI app")} · {t("Paying to")} <b>{upiName}</b>
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <a href={link} className="btn btn-primary btn-sm md:hidden">
                  <Smartphone className="size-4" /> {t("Open UPI app")}
                </a>
                <CopyButton text={upiId} label={upiId} />
              </div>
            </div>
          </div>
        ))}

      {mode === "bank" &&
        (!hasBank ? (
          notSetUp(t("Bank transfer"))
        ) : (
          <div className="space-y-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-800">{t("Send {amount} by NEFT / RTGS / IMPS to:", { amount: formatINR(balance) })}</p>
            {[
              ["Account name", bank.accountName],
              ["Account number", bank.accountNumber],
              ["IFSC", bank.ifsc],
              ["Bank", bank.name],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <span className="text-slate-500">{t(k)}</span>
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <span className="num">{v}</span>
                    <CopyButton text={v} label="" className="rounded-md p-1 text-slate-400 hover:bg-slate-100" />
                  </span>
                </div>
              ))}
            <p className="pt-1 text-xs text-slate-500">{t("Write “{no}” in the remarks.", { no: orderNo })}</p>
          </div>
        ))}

      {mode === "cash" && (
        <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <Banknote className="size-6 shrink-0" />
          <div>
            <p className="num text-base font-bold">{t("Pay {amount} in cash", { amount: formatINR(balance) })}</p>
            <p className="mt-0.5">
              {deliveryMethod === "pickup"
                ? t("Pay at the shop when you collect your goods.")
                : t("Pay at the shop, or as agreed with {name} for your parcel.", { name: ownerName })}{" "}
              {t("{name} will mark it as received — nothing else to do here.", { name: ownerName })}
            </p>
          </div>
        </div>
      )}

      {((mode === "upi" && upiId) || (mode === "bank" && hasBank)) && (
        <form action={action} className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-800">{t("After paying, tell us the reference number")}</p>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="method" value={mode} />
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <div>
              <label className="label" htmlFor="paid-amt">
                {t("Amount paid")}
              </label>
              <input
                id="paid-amt"
                name="amount"
                inputMode="numeric"
                className="input num"
                defaultValue={mode === "upi" ? amount : balance}
                key={`${mode}-${amount}`}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="utr">
                {t("UPI ref / UTR number")}
              </label>
              <input id="utr" name="reference" className="input num uppercase" placeholder={t("e.g. 431298765432")} required />
            </div>
          </div>
          <FormMessage state={state} />
          <SubmitButton className="btn btn-success w-full" pendingText={t("Sending…")}>
            {t("I have paid")}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
