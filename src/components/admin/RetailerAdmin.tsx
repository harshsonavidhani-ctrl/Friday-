"use client";

import { Ban, BookOpenText, Check, KeyRound, Link2, LoaderCircle, MessageCircle, Phone, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { adminCreateLoginLink, createRetailer, resetRetailerPassword, setRetailerStatus } from "@/app/actions/admin";
import { useT } from "@/components/LangProvider";
import { CopyButton, FormMessage, SubmitButton } from "@/components/ui";
import { formatDate, formatINR, telLink, waLink } from "@/lib/format";

export type RetailerRow = {
  id: number;
  name: string;
  shopName: string;
  phone: string;
  gstin: string;
  city: string;
  address: string;
  status: "pending" | "approved" | "blocked";
  createdAt: string;
  orderCount: number;
  outstanding: number;
};

type Mini = Pick<RetailerRow, "id" | "name" | "shopName" | "phone" | "status">;

/** Approve / login link / password / call / block — used on the list and the shop page. */
export function RetailerActions({
  r,
  shopName,
  siteUrl,
  highlightLink = false,
}: {
  r: Mini;
  shopName: string;
  siteUrl: string;
  highlightLink?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const set = (s: RetailerRow["status"]) =>
    start(async () => {
      await setRetailerStatus(r.id, s);
      router.refresh();
    });

  const makeLink = () =>
    start(async () => {
      setErr(null);
      const res = await adminCreateLoginLink(r.id);
      if (!res.ok) return setErr(t(res.error));
      setLink(res.url);
      setPw(null);
    });

  const linkMsg = link
    ? t("Namaste {name}! Tap this link to login to {shop} — no password needed:\n{url}\n(Works once, for 7 days.)", {
        name: r.name,
        shop: shopName,
        url: link,
      })
    : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {r.status !== "approved" && (
          <button type="button" className="btn btn-success btn-sm" disabled={pending} onClick={() => set("approved")}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {t("Approve")}
          </button>
        )}
        {r.status !== "blocked" && (
          <button
            type="button"
            className={`btn btn-whatsapp btn-sm ${highlightLink && !link ? "animate-pulse ring-4 ring-emerald-200" : ""}`}
            disabled={pending}
            onClick={makeLink}
          >
            <Link2 className="size-4" /> {t("Login link")}
          </button>
        )}
        <a href={telLink(r.phone)} className="btn btn-outline btn-sm">
          <Phone className="size-4" /> {t("Call")}
        </a>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await resetRetailerPassword(r.id);
              if (res.ok) {
                setPw(res.password);
                setLink(null);
              }
            })
          }
        >
          <KeyRound className="size-4" /> {t("New password")}
        </button>
        {r.status !== "blocked" ? (
          <button type="button" className="btn btn-ghost btn-sm text-rose-600" disabled={pending} onClick={() => set("blocked")}>
            <Ban className="size-4" /> {t("Block")}
          </button>
        ) : (
          <span className="badge bg-rose-50 text-rose-700 ring-rose-200">{t("Blocked")}</span>
        )}
      </div>
      {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}
      {link && (
        <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 ring-1 ring-emerald-200">
          <p className="font-semibold">{t("Login link ready — works once, for 7 days.")}</p>
          <p className="num break-all text-xs text-emerald-800">{link}</p>
          <div className="flex flex-wrap gap-2">
            <a href={waLink(r.phone, linkMsg)} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">
              <MessageCircle className="size-4" /> {t("Send on WhatsApp")}
            </a>
            <CopyButton text={link} label={t("Copy link")} />
          </div>
        </div>
      )}
      {pw && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gold-50 p-3 text-sm ring-1 ring-gold-200">
          <span>
            {t("New password")}: <b className="num text-lg">{pw}</b>
          </span>
          <CopyButton text={pw} />
          <a
            href={waLink(r.phone, t("Your new password for {shop} is: {pw}\nLogin: {url}", { shop: shopName, pw, url: `${siteUrl}/login` }))}
            target="_blank"
            rel="noreferrer"
            className="btn btn-whatsapp btn-sm"
          >
            <MessageCircle className="size-4" /> {t("Send on WhatsApp")}
          </a>
        </div>
      )}
    </div>
  );
}

export function RetailerCard({ r, shopName, siteUrl }: { r: RetailerRow; shopName: string; siteUrl: string }) {
  const t = useT();
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/admin/retailers/${r.id}`} className="group min-w-0">
          <p className="font-bold text-slate-900 group-hover:text-brand-800">{r.shopName || r.name}</p>
          <p className="text-sm text-slate-600">
            {r.name} · <span className="num">{r.phone}</span>
            {r.city && ` · ${r.city}`}
          </p>
          {r.gstin && <p className="num text-xs text-slate-500">GSTIN {r.gstin}</p>}
          <p className="text-xs text-slate-400">
            {t("Joined {date}", { date: formatDate(r.createdAt, false) })} · {t("{n} orders", { n: r.orderCount })}
          </p>
        </Link>
        <div className="flex flex-col items-end gap-1.5">
          {r.outstanding > 0 && (
            <span className="badge num bg-rose-50 text-rose-700 ring-rose-200">{t("To collect {amount}", { amount: formatINR(r.outstanding) })}</span>
          )}
          <Link href={`/admin/retailers/${r.id}`} className="btn btn-outline btn-sm">
            <BookOpenText className="size-4" /> {t("Khata")}
          </Link>
        </div>
      </div>
      <RetailerActions r={r} shopName={shopName} siteUrl={siteUrl} />
    </li>
  );
}

export function AddRetailerForm({ shopName, siteUrl, open }: { shopName: string; siteUrl: string; open: boolean }) {
  const t = useT();
  const [show, setShow] = useState(open);
  const [state, action] = useActionState(createRetailer, undefined);
  if (!show) {
    return (
      <button type="button" className="btn btn-gold" onClick={() => setShow(true)}>
        <UserPlus className="size-4" /> {t("Add retailer yourself")}
      </button>
    );
  }
  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-bold text-brand-950">{t("Add a retailer")}</h2>
        <p className="text-xs text-slate-500">{t("They are approved straight away. Leave password empty to create one automatically.")}</p>
      </div>
      <form action={action} className="space-y-3" key={state?.ok}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="shopName" className="input" placeholder={`${t("Shop name")} *`} required />
          <input name="name" className="input" placeholder={`${t("Owner name")} *`} required />
          <input name="phone" className="input num" inputMode="numeric" placeholder={`${t("Mobile number")} *`} required />
          <input name="city" className="input" placeholder={t("City")} />
          <input name="gstin" className="input uppercase" placeholder={`GSTIN (${t("optional")})`} maxLength={15} />
          <input name="password" className="input" placeholder={`${t("Password")} (${t("optional")})`} />
        </div>
        <textarea name="address" className="input" rows={2} placeholder={`${t("Address")} (${t("optional")})`} />
        {state?.error && <FormMessage state={state} />}
        <SubmitButton pendingText={t("Adding…")}>{t("Add retailer")}</SubmitButton>
      </form>
      {state?.ok && state.password && (
        <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p className="font-semibold">{t("{shop} added", { shop: state.ok })}</p>
          <p>
            {t("Login")}: <b className="num">{state.phone}</b> · {t("Password")}: <b className="num">{state.password}</b>
          </p>
          <a
            href={waLink(
              state.phone ?? "",
              t("Welcome to {shop}! See today's wholesale rates and order online.\nLogin: {url}\nMobile: {phone}\nPassword: {pw}", {
                shop: shopName,
                url: `${siteUrl}/login`,
                phone: state.phone ?? "",
                pw: state.password,
              }),
            )}
            target="_blank"
            rel="noreferrer"
            className="btn btn-whatsapp btn-sm"
          >
            <MessageCircle className="size-4" /> {t("Send login details on WhatsApp")}
          </a>
        </div>
      )}
    </div>
  );
}
