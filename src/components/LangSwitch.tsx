"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguage } from "@/app/actions/prefs";
import { useLang } from "@/components/LangProvider";

/** EN | हिं switch — saved on this device (and for alerts when logged in). */
export function LangSwitch({ dark = false, compact = false, className = "" }: { dark?: boolean; compact?: boolean; className?: string }) {
  const lang = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: "en" | "hi") =>
    l !== lang &&
    start(async () => {
      await setLanguage(l);
      router.refresh();
    });
  if (compact) {
    // one small button that switches to the other language
    const other = lang === "hi" ? "en" : "hi";
    return (
      <button
        type="button"
        onClick={() => choose(other)}
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold ${
          dark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
        } ${pending ? "opacity-60" : ""} ${className}`}
        aria-label={other === "hi" ? "हिंदी में देखें" : "View in English"}
      >
        <Languages className="size-3.5" aria-hidden />
        {other === "hi" ? "हिंदी" : "EN"}
      </button>
    );
  }
  const base = "rounded-md px-2 py-1 text-xs font-bold transition";
  const on = dark ? "bg-gold-400 text-brand-950" : "bg-brand-900 text-white";
  const off = dark ? "text-white/70 hover:text-white" : "text-slate-600 hover:text-slate-900";
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 ${dark ? "bg-white/10" : "bg-slate-100"} ${pending ? "opacity-60" : ""} ${className}`}
      role="group"
      aria-label="Language / भाषा"
    >
      <Languages className={`mx-1 size-3.5 ${dark ? "text-white/60" : "text-slate-400"}`} aria-hidden />
      <button type="button" className={`${base} ${lang === "en" ? on : off}`} onClick={() => choose("en")} aria-pressed={lang === "en"}>
        EN
      </button>
      <button type="button" className={`${base} ${lang === "hi" ? on : off}`} onClick={() => choose("hi")} aria-pressed={lang === "hi"}>
        हिंदी
      </button>
    </div>
  );
}
