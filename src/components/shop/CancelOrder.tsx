"use client";

import { useState } from "react";
import { cancelMyOrder } from "@/app/actions/shop";
import { useT } from "@/components/LangProvider";
import { ConfirmButton } from "@/components/ui";

export function CancelOrder({ orderId }: { orderId: number }) {
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <ConfirmButton
        onConfirm={async () => {
          const r = await cancelMyOrder(orderId);
          setErr(r.error ? t(r.error) : null);
        }}
        confirmText={t("Tap again to cancel order")}
      >
        {t("Cancel order")}
      </ConfirmButton>
      {err && <p className="text-sm text-rose-600">{err}</p>}
    </div>
  );
}
