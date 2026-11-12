import type { OrderStatus } from "@/db/schema";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAY_STATE_LABEL,
  PAY_STATE_TONE,
  type PayState,
} from "@/lib/constants";
import { getT } from "@/lib/i18n-server";

export async function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = await getT();
  return <span className={`badge ${ORDER_STATUS_TONE[status]}`}>{t(ORDER_STATUS_LABEL[status])}</span>;
}

export async function PayStateBadge({ state }: { state: PayState }) {
  const t = await getT();
  return <span className={`badge ${PAY_STATE_TONE[state]}`}>{t(PAY_STATE_LABEL[state])}</span>;
}
