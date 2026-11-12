"use client";

import { Bell, BellRing, ClipboardList, IndianRupee, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markAllNotificationsRead } from "@/app/actions/prefs";
import { useT } from "@/components/LangProvider";
import { relativeDay } from "@/lib/format";

export type NoteRow = { id: number; kind: string; title: string; body: string; url: string; readAt: string | null; createdAt: string };

const ICON: Record<string, typeof Bell> = { order: ClipboardList, payment: IndianRupee, account: UserRound, info: BellRing };

export function NotificationList({ rows }: { rows: NoteRow[] }) {
  const t = useT();
  const router = useRouter();
  const unread = rows.some((r) => !r.readAt);

  useEffect(() => {
    if (!unread) return;
    const id = setTimeout(() => void markAllNotificationsRead().then(() => router.refresh()), 1200);
    return () => clearTimeout(id);
  }, [unread, router]);

  if (!rows.length) {
    return (
      <div className="card flex flex-col items-center gap-2 p-10 text-center">
        <Bell className="size-10 text-slate-300" />
        <p className="font-semibold text-slate-800">{t("No alerts yet")}</p>
        <p className="text-sm text-slate-500">{t("Order and payment updates will show here.")}</p>
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-slate-100 overflow-hidden">
      {rows.map((n) => {
        const Icon = ICON[n.kind] ?? Bell;
        const body = (
          <div className={`flex gap-3 p-4 ${n.readAt ? "" : "bg-gold-50/60"}`}>
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                n.readAt ? "bg-slate-100 text-slate-500" : "bg-brand-900 text-gold-300"
              }`}
            >
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{n.title}</p>
              {n.body && <p className="text-sm whitespace-pre-line text-slate-600">{n.body}</p>}
              <p className="mt-0.5 text-xs text-slate-400">{relativeDay(n.createdAt)}</p>
            </div>
            {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" aria-label={t("New")} />}
          </div>
        );
        return (
          <li key={n.id}>
            {n.url ? (
              <Link href={n.url} className="block hover:bg-slate-50">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function BellLink({ href, count, className = "" }: { href: string; count: number; className?: string }) {
  const t = useT();
  return (
    <Link href={href} className={`relative inline-flex items-center justify-center rounded-lg p-2 ${className}`} aria-label={t("Alerts")}>
      <Bell className="size-5" />
      {count > 0 && (
        <span className="num absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] leading-[18px] font-bold text-white ring-2 ring-brand-950">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
