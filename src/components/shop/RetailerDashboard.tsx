import { BookOpenText, ClipboardList, Clock, LayoutGrid, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { RateBoard } from "@/components/shop/RateBoard";
import type { CurrentUser } from "@/lib/auth";
import { getCart, getMaxQty } from "@/lib/cart";
import { formatINR, relativeDay } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getDueOrders } from "@/lib/khata";
import { listOrders } from "@/lib/orders";
import { getRateBoard } from "@/lib/rate-board";

/** What an approved retailer sees after login: today's rates (read-only) + add to cart. */
export async function RetailerDashboard({ user }: { user: CurrentUser }) {
  const [board, lines, maxQty, orders, due, t] = await Promise.all([
    getRateBoard(),
    getCart(user.id),
    getMaxQty(),
    listOrders({ userId: user.id, limit: 50 }),
    getDueOrders(user.id),
    getT(),
  ]);
  const inCart = Object.fromEntries(lines.map((l) => [l.variantId, l.qty]));
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const open = orders.filter((o) => !["completed", "cancelled"].includes(o.order.status)).length;
  const balance = due.reduce((s, d) => s + d.due, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl">{t("Namaste, {name}", { name: user.name.split(" ")[0] })}</h1>
          {board.updatedAt && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              <Clock className="size-4" /> {t("Rates updated {when}", { when: relativeDay(board.updatedAt) })}
            </p>
          )}
        </div>
        <Link href="/products" className="btn btn-outline btn-sm">
          <LayoutGrid className="size-4" /> {t("Browse with photos")}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile href="/cart" icon={ShoppingCart} label={t("Cart")} value={cartCount ? formatINR(cartTotal) : "0"} tone="text-brand-950" />
        <Tile href="/orders" icon={ClipboardList} label={t("Open orders")} value={String(open)} tone="text-brand-950" />
        <Tile href="/account/khata" icon={BookOpenText} label={t("To pay")} value={formatINR(balance)} tone={balance > 0 ? "text-rose-700" : "text-emerald-700"} />
      </div>

      <h2 className="text-xl font-extrabold text-brand-950">{t("Today's rates")}</h2>
      {board.brands.length ? (
        <RateBoard brands={board.brands} inCart={inCart} cartCount={cartCount} cartTotal={cartTotal} maxQty={maxQty} />
      ) : (
        <p className="card p-8 text-center text-slate-500">{t("Products will appear here soon.")}</p>
      )}
    </div>
  );
}

function Tile({ href, icon: Icon, label, value, tone }: { href: string; icon: typeof Clock; label: string; value: string; tone: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-1 p-3 hover:ring-brand-300">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Icon className="size-4" /> {label}
      </span>
      <span className={`num truncate text-lg font-extrabold ${tone}`}>{value}</span>
    </Link>
  );
}
