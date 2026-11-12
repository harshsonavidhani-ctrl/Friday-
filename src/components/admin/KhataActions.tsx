"use client";

import { Check, LoaderCircle, MessageCircle, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminKhataPayment } from "@/app/actions/admin";
import type { PaymentMethod } from "@/db/schema";
import { useT } from "@/components/LangProvider";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatINR, waLink } from "@/lib/format";

type Due = { no: string; date: string; due: number };

export function KhataActions({
  userId,
  name,
  phone,
  balance,
  due,
  shopName,
  siteUrl,
  printHref,
}: {
  userId: number;
  name: string;
  phone: string;
  balance: number;
  due: Due[];
  shopName: string;
  siteUrl: string;
  printHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  const lines = due.slice(0, 8).map((d) => `• ${d.no} (${d.date}) — ${formatINR(d.due)}`);
  const reminder = [
    t("Namaste {name} ji,", { name }),
    t("Your balance with {shop} is *{amount}*.", { shop: shopName, amount: formatINR(balance) }),
    "",
    ...lines,
    due.length > 8 ? t("…and {n} more", { n: due.length - 8 }) : "",
    "",
    t("Pay by UPI / see your khata: {url}", { url: `${siteUrl}/account/khata` }),
    `— ${shopName}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await adminKhataPayment(userId, Number(amount), method, ref);
      if (!r.ok) return setMsg({ error: t(r.error) });
      setMsg({ ok: t("Saved — adjusted against {n} order(s), oldest first.", { n: r.orders }) });
      setRef("");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {balance > 0 && (
          <a href={waLink(phone, reminder)} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">
            <MessageCircle className="size-4" /> {t("Send payment reminder")}
          </a>
        )}
        <Link href={printHref} className="btn btn-outline btn-sm">
          <Printer className="size-4" /> {t("Print / PDF statement")}
        </Link>
      </div>

      {balance > 0 && (
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-800">{t("Received money from this shop?")}</p>
          <p className="mb-2 text-xs text-slate-500">{t("It is adjusted against the oldest unpaid orders first.")}</p>
          <div className="grid gap-2 sm:grid-cols-[130px_150px_1fr_auto]">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="input num py-2"
              placeholder={t("₹ Amount")}
              aria-label={t("Amount")}
            />
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="input py-2" aria-label={t("Method")}>
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {t(PAYMENT_METHOD_LABEL[m])}
                </option>
              ))}
            </select>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="input py-2" placeholder={t("Note / UTR / cheque no. (optional)")} />
            <button type="button" className="btn btn-primary" disabled={pending || !Number(amount)} onClick={save}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {t("Save")}
            </button>
          </div>
          {msg && <p className={`mt-2 text-sm font-semibold ${msg.error ? "text-rose-600" : "text-emerald-700"}`}>{msg.error ?? msg.ok}</p>}
        </div>
      )}
    </div>
  );
}
