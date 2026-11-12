import { asc, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { getDb, orderItems, orderSerials } from "@/db";
import { getAdminOrNull } from "@/lib/auth";
import { ORDER_STATUS_LABEL, PAY_PLAN_LABEL } from "@/lib/constants";
import { addTable, istDate, xlsxResponse } from "@/lib/excel-export";
import { orderNo } from "@/lib/format";
import { listOrders } from "@/lib/orders";

/** All orders (latest 5000) + every item line with IMEIs, for accounts / Tally entry. */
export async function GET(req: Request) {
  if (!(await getAdminOrNull())) return new Response("Please login as admin", { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  let rows = await listOrders({ limit: 5000 });
  if (from) rows = rows.filter((r) => istDate(new Date(r.order.createdAt)) >= from);
  if (to) rows = rows.filter((r) => istDate(new Date(r.order.createdAt)) <= to);

  const ids = rows.map((r) => r.order.id);
  const db = await getDb();
  const [items, serials] = ids.length
    ? await Promise.all([
        db.select().from(orderItems).where(inArray(orderItems.orderId, ids)).orderBy(asc(orderItems.orderId), asc(orderItems.id)),
        db.select().from(orderSerials).where(inArray(orderSerials.orderId, ids)).orderBy(asc(orderSerials.id)),
      ])
    : [[], []];
  const byOrder = new Map(rows.map((r) => [r.order.id, r]));
  const serialsByItem = new Map<number, string[]>();
  for (const s of serials) serialsByItem.set(s.orderItemId, [...(serialsByItem.get(s.orderItemId) ?? []), s.serial]);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

  const wb = new ExcelJS.Workbook();
  addTable(
    wb,
    "Orders",
    [
      { header: "Order No", key: "no", width: 11 },
      { header: "Date", key: "date", width: 12 },
      { header: "Shop", key: "shop", width: 26 },
      { header: "Owner", key: "owner", width: 18 },
      { header: "Phone", key: "phone", width: 13 },
      { header: "Status", key: "status", width: 20 },
      { header: "Pieces", key: "pcs", width: 8 },
      { header: "Items Total", key: "subtotal", width: 13, money: true },
      { header: "Parcel", key: "parcel", width: 10, money: true },
      { header: "Discount", key: "discount", width: 10, money: true },
      { header: "Total", key: "total", width: 13, money: true },
      { header: "Paid", key: "paid", width: 13, money: true },
      { header: "Balance", key: "balance", width: 13, money: true },
      { header: "Pay By", key: "plan", width: 15 },
      { header: "Delivery", key: "delivery", width: 10 },
      { header: "Transport / LR", key: "transport", width: 20 },
    ],
    rows.map((r) => ({
      no: orderNo(r.order.id),
      date: fmt(r.order.createdAt),
      shop: r.shopName,
      owner: r.customerName,
      phone: r.phone,
      status: ORDER_STATUS_LABEL[r.order.status],
      pcs: r.itemCount,
      subtotal: r.order.subtotal,
      parcel: r.order.parcelCharge,
      discount: r.order.discount,
      total: r.order.total,
      paid: r.pay.verified,
      balance: r.order.status === "cancelled" ? 0 : Math.max(0, r.order.total - r.pay.verified),
      plan: PAY_PLAN_LABEL[r.order.payPlan],
      delivery: r.order.deliveryMethod === "parcel" ? "Parcel" : "Pickup",
      transport: r.order.transportInfo,
    })),
  );
  addTable(
    wb,
    "Items",
    [
      { header: "Order No", key: "no", width: 11 },
      { header: "Date", key: "date", width: 12 },
      { header: "Shop", key: "shop", width: 26 },
      { header: "Item", key: "item", width: 34 },
      { header: "Variant", key: "variant", width: 16 },
      { header: "Qty", key: "qty", width: 7 },
      { header: "Rate", key: "rate", width: 12, money: true },
      { header: "Amount", key: "amount", width: 13, money: true },
      { header: "IMEI / Serial", key: "imei", width: 40 },
    ],
    items.map((i) => {
      const o = byOrder.get(i.orderId)!;
      return {
        no: orderNo(i.orderId),
        date: fmt(o.order.createdAt),
        shop: o.shopName,
        item: i.name,
        variant: i.variantLabel,
        qty: i.qty,
        rate: i.price,
        amount: i.price * i.qty,
        imei: (serialsByItem.get(i.id) ?? []).join(", "),
      };
    }),
  );
  return xlsxResponse(wb, `orders-${istDate()}.xlsx`);
}
