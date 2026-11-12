import type { Metadata } from "next";
import { NotificationList } from "@/components/Notifications";
import { PushToggle } from "@/components/PushToggle";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getNotifications } from "@/lib/notify";
import { getVapidKeys } from "@/lib/push";

export const metadata: Metadata = { title: "Alerts" };

export default async function NotificationsPage() {
  const me = await requireUser("/notifications");
  const [rows, keys, t] = await Promise.all([getNotifications(me.id), getVapidKeys(), getT()]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{t("Alerts")}</h1>
      <div className="card p-4">
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
