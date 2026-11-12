"use client";

import { Download, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install app" — Android/desktop Chrome show a real button; iPhone gets the 2-step hint. */
export function InstallApp() {
  const t = useT();
  const [evt, setEvt] = useState<BIP | null>(null);
  const [mode, setMode] = useState<"hidden" | "button" | "ios">("hidden");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
      setMode("button");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const timer = ios ? setTimeout(() => setMode("ios"), 0) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (mode === "hidden") return null;
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-gold-300">
        <Smartphone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand-950">{t("Install the app")}</p>
        <p className="text-sm text-slate-500">
          {mode === "ios"
            ? t("Tap Share, then “Add to Home Screen”.")
            : t("Opens from your home screen like any app. Free, takes 2 seconds.")}
        </p>
      </div>
      {mode === "button" && evt ? (
        <button
          type="button"
          className="btn btn-gold"
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice;
            setEvt(null);
            setMode("hidden");
          }}
        >
          <Download className="size-4" /> {t("Install")}
        </button>
      ) : (
        <Share className="size-5 text-slate-400" />
      )}
    </div>
  );
}
