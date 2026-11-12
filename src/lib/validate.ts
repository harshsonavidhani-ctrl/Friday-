import { digitsOnly } from "./format";

export type FormState = { error?: string; ok?: string } | undefined;

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Whole rupees from a form field; "" -> fallback. Accepts "1,25,000". */
export function rupees(raw: unknown, fallback = 0): number {
  const s = String(raw ?? "").replace(/[,₹\s]/g, "");
  if (!s) return fallback;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function normalizePhone(raw: string): string | null {
  let d = digitsOnly(raw);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function safeNext(next: string, fallback: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
