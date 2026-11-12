"use client";

import { Check, LoaderCircle, MessageCircle, PackageCheck, Truck, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  adminRecordPayment,
  adminSetOrderStatus,
  adminSetPaymentStatus,
  adminUndoPayment,
  adminUpdateOrder,
} from "@/app/actions/admin";
import type { OrderStatus, PaymentMethod } from "@/db/schema";
import { ProductImage } from "@/components/ProductImage";
import { useT } from "@/components/LangProvider";
import { ConfirmButton } from "@/components/ui";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatINR, waLink } from "@/lib/format";

type Item = { id: number; name: string; variantLabel: string; image: string | null; price: number; qty: number };

export function OrderEditor({
  orderId,
  status,
  items,
  parcelCharge,
  discount,
  transportInfo,
  deliveryMethod,
}: {
  orderId: number;
  status: OrderStatus;
  items: Item[];
  parcelCharge: number;
  discount: number;
  transportInfo: string;
  deliveryMethod: "pickup" | "parcel";
}) {
  const t = useT();
  const router = useRouter();
  const editable = status !== "cancelled" && status !== "completed";
  const [rows, setRows] = useState(items.map((i) => ({ ...i, qtyS: String(i.qty), priceS: String(i.price) })));
  const [parcel, setParcel] = useState(String(parcelCharge || ""));
  const [disc, setDisc] = useState(String(discount || ""));
  const [transport, setTransport] = useState(transportInfo);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  const subtotal = rows.reduce((s, r) => s + (Number(r.priceS) || 0) * (Number(r.qtyS) || 0), 0);
  const total = Math.max(0, subtotal + (Number(parcel) || 0) - (Number(disc) || 0));
  const dirty = useMemo(
    () =>
      rows.some((r, i) => Number(r.qtyS) !== items[i].qty || Number(r.priceS) !== items[i].price) ||
      (Number(parcel) || 0) !== parcelCharge ||
      (Number(disc) || 0) !== discount ||
      transport !== transportInfo,
    [rows, items, parcel, disc, transport, parcelCharge, discount, transportInfo],
  );

  function save() {
    setMsg(null);
    start(async () => {
      const r = await adminUpdateOrder(orderId, {
        items: rows.map((r) => ({ id: r.id, qty: Number(r.qtyS) || 0, price: Number(r.priceS) || 0 })),
        parcelCharge: Number(parcel) || 0,
        discount: Number(disc) || 0,
        transportInfo: transport,
      });
      if (!r.ok) return setMsg({ error: t(r.error) });
      setMsg({ ok: t("Saved. New total {amount}", { amount: formatINR(r.total) }) });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {rows.map((r, idx) => (
          <li key={r.id} className={`flex gap-3 py-3 ${Number(r.qtyS) === 0 ? "opacity-50" : ""}`}>
            <ProductImage src={r.image} alt={r.name} className="size-14 shrink-0 rounded-lg ring-1 ring-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                {r.variantLabel && <p className="text-xs text-slate-500">{r.variantLabel}</p>}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Small label={t("Qty")} value={r.qtyS} disabled={!editable} onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, qtyS: v } : x)))} w="w-16" />
                <span className="pb-2 text-slate-400">×</span>
                <Small label={t("Rate ₹")} value={r.priceS} disabled={!editable} onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, priceS: v } : x)))} w="w-28" />
                <span className="num pb-2 text-sm font-bold text-slate-900">= {formatINR((Number(r.qtyS) || 0) * (Number(r.priceS) || 0))}</span>
                {editable && Number(r.qtyS) > 0 && (
                  <button
                    type="button"
                    className="pb-2 text-xs font-semibold text-rose-600"
                    onClick={() => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, qtyS: "0" } : x)))}
                  >
                    {t("Remove")}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
        <Small label={t("Parcel / transport charge ₹")} value={parcel} disabled={!editable} onChange={setParcel} w="w-full" />
        <Small label={t("Discount ₹")} value={disc} disabled={!editable} onChange={setDisc} w="w-full" />
        {deliveryMethod === "parcel" && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">{t("Transport name / LR no.")}</span>
            <input value={transport} disabled={!editable} onChange={(e) => setTransport(e.target.value)} className="input py-2 text-sm" placeholder={t("e.g. VRL · LR 55231")} />
          </label>
        )}
      </div>

      <div className="num flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
        <span className="font-semibold text-brand-900">{t("Order total")}</span>
        <span className="text-xl font-extrabold text-brand-950">{formatINR(total)}</span>
      </div>

      {msg && <p className={`text-sm font-semibold ${msg.error ? "text-rose-600" : "text-emerald-700"}`}>{msg.error ?? msg.ok}</p>}
      {editable && dirty && (
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary w-full">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {t("Save changes")}
        </button>
      )}
    </div>
  );
}

function Small({ label, value, onChange, disabled, w }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; w: string }) {
  return (
    <label className={`block ${w}`}>
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="num w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-right text-base focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
      />
    </label>
  );
}

export function StatusActions({
  orderId,
  status,
  deliveryMethod,
  waPhone,
  waText,
}: {
  orderId: number;
  status: OrderStatus;
  deliveryMethod: "pickup" | "parcel";
  waPhone: string;
  waText: Record<string, string>;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [lastSet, setLastSet] = useState<OrderStatus | null>(null);

  const go = (s: OrderStatus) =>
    start(async () => {
      setErr(null);
      const r = await adminSetOrderStatus(orderId, s);
      if (!r.ok) return setErr(t(r.error));
      setLastSet(s);
      router.refresh();
    });

  const next: { s: OrderStatus; label: string; icon: typeof Check; cls: string }[] = [];
  if (status === "pending") next.push({ s: "confirmed", label: t("Confirm order"), icon: Check, cls: "btn-success" });
  if (status === "confirmed") {
    if (deliveryMethod === "parcel") next.push({ s: "dispatched", label: t("Mark parcel dispatched"), icon: Truck, cls: "btn-primary" });
    else next.push({ s: "ready", label: t("Mark ready for pickup"), icon: PackageCheck, cls: "btn-primary" });
  }
  if (status === "confirmed" || status === "dispatched" || status === "ready") {
    next.push({ s: "completed", label: t("Mark completed"), icon: Check, cls: status === "confirmed" ? "btn-outline" : "btn-success" });
  }

  const message = lastSet ? waText[lastSet] : waText[status];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {next.map(({ s, label, icon: Icon, cls }) => (
          <button key={s} type="button" disabled={pending} onClick={() => go(s)} className={`btn ${cls}`}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />} {label}
          </button>
        ))}
        {status !== "cancelled" && status !== "completed" && (
          <ConfirmButton onConfirm={() => go("cancelled")} confirmText={t("Tap again to cancel")} className="btn btn-outline text-rose-600">
            <X className="size-4" /> {t("Cancel order")}
          </ConfirmButton>
        )}
      </div>
      {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}
      {waPhone && message && (
        <a href={waLink(waPhone, message)} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">
          <MessageCircle className="size-4" /> {t("Send update on WhatsApp")}
        </a>
      )}
    </div>
  );
}

type Pay = { id: number; amount: number; method: PaymentMethod; reference: string; status: string; byAdmin: boolean; createdAt: string };

export function PaymentsAdmin({ orderId, payments, balance }: { orderId: number; payments: Pay[]; balance: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(balance || ""));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {payments.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="num font-bold text-slate-900">{formatINR(p.amount)}</p>
                <p className="text-xs text-slate-500">
                  {t(PAYMENT_METHOD_LABEL[p.method])} {p.reference && <>· <span className="num font-semibold text-slate-700">{p.reference}</span></>} ·{" "}
                  {formatDate(p.createdAt)} · {p.byAdmin ? t("entered by you") : t("sent by retailer")}
                </p>
              </div>
              {p.status === "submitted" ? (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={pending}
                    onClick={() => start(async () => void (await adminSetPaymentStatus(p.id, "verified"), router.refresh()))}
                  >
                    <Check className="size-4" /> {t("Received")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm text-rose-600"
                    disabled={pending}
                    onClick={() => start(async () => void (await adminSetPaymentStatus(p.id, "rejected"), router.refresh()))}
                  >
                    {t("Not received")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`badge ${p.status === "verified" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}
                  >
                    {p.status === "verified" ? t("Received") : t("Not received")}
                  </span>
                  <ConfirmButton
                    onConfirm={async () => {
                      await adminUndoPayment(p.id);
                      router.refresh();
                    }}
                    className="btn btn-ghost btn-sm text-slate-500"
                    confirmClassName="btn btn-sm bg-gold-400 text-brand-950"
                    confirmText={p.byAdmin ? t("Tap again to remove") : t("Tap again to undo")}
                  >
                    <Undo2 className="size-4" /> {t("Undo")}
                  </ConfirmButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="mb-2 text-sm font-semibold text-slate-800">{t("Record a payment you received")}</p>
        <div className="grid gap-2 sm:grid-cols-[120px_150px_1fr_auto]">
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className="input num py-2" placeholder={t("₹ Amount")} aria-label={t("Amount")} />
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="input py-2" aria-label={t("Method")}>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {t(PAYMENT_METHOD_LABEL[m])}
              </option>
            ))}
          </select>
          <input value={ref} onChange={(e) => setRef(e.target.value)} className="input py-2" placeholder={t("Note / UTR / cheque no. (optional)")} aria-label={t("Reference")} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || !Number(amount)}
            onClick={() =>
              start(async () => {
                setErr(null);
                const r = await adminRecordPayment(orderId, Number(amount), method, ref);
                if (!r.ok) return setErr(t(r.error));
                setRef("");
                router.refresh();
              })
            }
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {t("Add")}
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      </div>
    </div>
  );
}
