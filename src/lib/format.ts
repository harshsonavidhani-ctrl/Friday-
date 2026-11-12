// Pure helpers, safe to use in both server and client components.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 125000 -> "₹1,25,000" */
export function formatINR(n: number): string {
  return inr.format(n);
}

const IST = "Asia/Kolkata";

export function formatDate(d: Date | string, withTime = true): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(d));
}

export function formatTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

function istDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d);
}

/** "today, 10:30 am" / "yesterday" / "5 Nov 2026" */
export function relativeDay(d: Date | string): string {
  const date = new Date(d);
  const now = new Date();
  if (istDayKey(date) === istDayKey(now)) return `today, ${formatTime(date)}`;
  const y = new Date(now.getTime() - 86400000);
  if (istDayKey(date) === istDayKey(y)) return "yesterday";
  return formatDate(date, false);
}

export function orderNo(id: number): string {
  return `LA-${1000 + id}`;
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** WhatsApp click-to-chat link. Empty phone opens the contact picker. */
export function waLink(phone: string, text: string): string {
  let digits = digitsOnly(phone);
  if (digits.length === 10) digits = "91" + digits;
  const t = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${t}` : `https://wa.me/?text=${t}`;
}

export function telLink(phone: string): string {
  return `tel:${digitsOnly(phone)}`;
}

/** Retailer margin vs MRP, in % (null when MRP missing or lower). */
export function marginPct(price: number, mrp: number | null | undefined): number | null {
  if (!mrp || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
