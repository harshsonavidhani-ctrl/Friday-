// English / हिंदी — client-safe. English text is the key; Hindi lives in ./hi.ts.
import { HI } from "./hi";

export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_COOKIE = "la_lang";

export type Vars = Record<string, string | number>;
export type T = (s: string, vars?: Vars) => string;

export function translate(lang: Lang, s: string, vars?: Vars): string {
  let out = lang === "hi" ? (HI[s] ?? s) : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return out;
}

export function makeT(lang: Lang): T {
  return (s, vars) => translate(lang, s, vars);
}

export function toLang(v: unknown): Lang {
  return v === "hi" ? "hi" : "en";
}
