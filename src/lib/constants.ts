// Shared labels — client-safe (type-only imports from the schema).
import type { OrderStatus, PaymentMethod, PayPlan } from "@/db/schema";

/** "How will you pay?" — chosen by the retailer at checkout. */
export const PAY_PLAN_LABEL: Record<PayPlan, string> = {
  upi: "UPI / QR",
  bank: "Bank transfer",
  cash: "Cash at shop",
  credit: "Credit (udhaar)",
};

export const PAY_PLAN_HINT: Record<PayPlan, string> = {
  upi: "GPay, PhonePe, Paytm",
  bank: "NEFT / RTGS / IMPS",
  cash: "Pay when you collect",
  credit: "Pay later, if {name} agrees",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  dispatched: "Parcel dispatched",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-gold-100 text-gold-800 ring-gold-300",
  confirmed: "bg-brand-100 text-brand-800 ring-brand-200",
  dispatched: "bg-violet-100 text-violet-800 ring-violet-200",
  ready: "bg-violet-100 text-violet-800 ring-violet-200",
  completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  bank: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

export type PayState = "unpaid" | "partial" | "to_verify" | "paid";

export const PAY_STATE_LABEL: Record<PayState, string> = {
  unpaid: "Unpaid",
  partial: "Partly paid",
  to_verify: "Payment to verify",
  paid: "Paid",
};

export const PAY_STATE_TONE: Record<PayState, string> = {
  unpaid: "bg-rose-50 text-rose-700 ring-rose-200",
  partial: "bg-gold-50 text-gold-800 ring-gold-200",
  to_verify: "bg-sky-50 text-sky-700 ring-sky-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function paymentSummary(
  total: number,
  pays: { amount: number; status: string }[],
) {
  let verified = 0;
  let submitted = 0;
  for (const p of pays) {
    if (p.status === "verified") verified += p.amount;
    else if (p.status === "submitted") submitted += p.amount;
  }
  const balance = Math.max(0, total - verified - submitted);
  const state: PayState =
    total > 0 && verified >= total
      ? "paid"
      : submitted > 0
        ? "to_verify"
        : verified > 0
          ? "partial"
          : "unpaid";
  return { verified, submitted, balance, state, excess: Math.max(0, verified - total) };
}

export const CATEGORY_ICON_KEYS = [
  "smartphone",
  "tablet",
  "tv",
  "microwave",
  "refrigerator",
  "washing-machine",
  "air-vent",
  "speaker",
  "headphones",
  "watch",
  "laptop",
  "cooking-pot",
  "fan",
  "cable",
  "plug",
  "package",
] as const;
