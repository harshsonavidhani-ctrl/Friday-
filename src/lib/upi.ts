// Client-safe UPI helpers.

export function isValidUpiId(id: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(id.trim());
}

/**
 * Standard UPI payment link. Any UPI app (GPay, PhonePe, Paytm, BHIM)
 * reads it, and the QR made from it has the exact amount filled in.
 * The UPI ID (pa) is left unencoded on purpose: several apps reject "%40".
 */
export function upiLink(opts: { upiId: string; name: string; amount: number; note: string }): string {
  const parts = [
    `pa=${opts.upiId.trim()}`,
    `pn=${encodeURIComponent(opts.name)}`,
    `am=${opts.amount.toFixed(2)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(opts.note.slice(0, 50))}`,
  ];
  return `upi://pay?${parts.join("&")}`;
}

/** Splits a big amount into UPI-sized parts: 250000 @ 100000 -> [100000, 100000, 50000] */
export function splitAmount(total: number, limit: number): number[] {
  if (limit <= 0 || total <= limit) return [total];
  const parts: number[] = [];
  let left = total;
  while (left > 0) {
    parts.push(Math.min(limit, left));
    left -= limit;
  }
  return parts;
}
