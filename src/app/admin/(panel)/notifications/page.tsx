import type { Metadata } from "next";
import { NotificationList } from "@/components/Notifications";
import { PushToggle } from "@/components/PushToggle";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getNotifications } from "@/lib/notify";
import { getVapidKeys } from "@/lib/push";

export const metadata: Metadata = { title: "Alerts" };

export default async function AdminNotificationsPage() {
  const me = await requireAdmin();
  const [rows, keys, t] = await Promise.all([getNotifications(me.id, 100), getVapidKeys(), getT()]);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Alerts")}</h1>
      <div className="card space-y-2 p-4">
        <p className="text-sm text-slate-600">{t("Get a ping on this phone for every new order, payment and new shop.")}</p>
        <PushToggle publicKey={keys.publicKey} compact />
      </div>
      <NotificationList
        rows={rows.map((r) => ({
          ...r,
          readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
          createdAt: new Date(r.createdAt).toISOString(),
        }))}
      />
    </div>
  );
}
