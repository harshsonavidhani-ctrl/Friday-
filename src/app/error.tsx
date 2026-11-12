"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/Logo";
import { useT } from "@/components/LangProvider";

/** Friendly screen instead of a crash (e.g. internet dropped while saving). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark className="size-14" />
      <h1 className="text-2xl font-extrabold text-brand-950">{t("Something went wrong")}</h1>
      <p className="max-w-sm text-slate-500">{t("Please check your internet and try again. If it keeps happening, call the shop.")}</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={reset}>
          <RotateCcw className="size-4" /> {t("Try again")}
        </button>
        <Link href="/" className="btn btn-outline">
          {t("Go to shop")}
        </Link>
      </div>
      {error.digest && <p className="num text-xs text-slate-400">Ref: {error.digest}</p>}
    </div>
  );
}
