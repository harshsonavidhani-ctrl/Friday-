"use client";

import { BellOff, BellRing, Check, LoaderCircle, Send, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestAlert } from "@/app/actions/prefs";
import { useT } from "@/components/LangProvider";

type State = "loading" | "insecure" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function detect(): Promise<{ state: State; sub: PushSubscription | null }> {
  await Promise.resolve();
  if (!window.isSecureContext) return { state: "insecure", sub: null };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { state: ios && !standalone ? "ios-install" : "unsupported", sub: null };
  }
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const sub = await reg.pushManager.getSubscription();
  if (Notification.permission === "denied") return { state: "denied", sub: null };
  return { state: sub ? "on" : "off", sub };
}

/** "Get alerts on this phone" — order & payment notifications. */
export function PushToggle({ publicKey, compact = false }: { publicKey: string; compact?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    detect()
      .then(async ({ state, sub }) => {
        if (!alive) return;
        setState(state);
        // keep the server copy linked to whoever is logged in on this phone now
        if (sub) await savePushSubscription(JSON.parse(JSON.stringify(sub)));
      })
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = () =>
    start(async () => {
      setMsg(null);
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setState(perm === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
        if (r.error) {
          setMsg(t(r.error));
          return;
        }
        setState("on");
        await sendTestAlert();
        setMsg(t("Done! A test alert was sent to this device."));
        router.refresh();
      } catch {
        setMsg(t("Could not turn on alerts on this device."));
      }
    });

  const turnOff = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMsg(null);
    });

  const test = () =>
    start(async () => {
      await sendTestAlert();
      setMsg(t("Test alert sent."));
      router.refresh();
    });

  if (state === "loading") return null;

  const note = (text: string) => (
    <p className={`flex items-start gap-2 text-sm text-slate-600 ${compact ? "" : "rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"}`}>
      <Smartphone className="mt-0.5 size-4 shrink-0 text-slate-400" /> {text}
    </p>
  );

  if (state === "insecure") return note(t("Phone alerts start working once the website is live (https). Alerts still show in the bell icon."));
  if (state === "ios-install") return note(t("On iPhone: tap Share → Add to Home Screen, open the app from there, then turn on alerts."));
  if (state === "unsupported") return note(t("This browser cannot show alerts. Use Chrome on Android, or check the bell icon."));
  if (state === "denied") return note(t("Alerts are blocked for this website. Allow notifications in your browser settings, then reload."));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {state === "off" ? (
          <button type="button" className="btn btn-gold" onClick={turnOn} disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <BellRing className="size-4" />} {t("Turn on alerts on this phone")}
          </button>
        ) : (
          <>
            <span className="badge bg-emerald-50 py-1 text-emerald-700 ring-emerald-200">
              <Check className="size-3.5" /> {t("Alerts are on for this device")}
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={test} disabled={busy}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} {t("Send test")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm text-slate-500" onClick={turnOff} disabled={busy}>
              <BellOff className="size-4" /> {t("Turn off")}
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-sm font-medium text-emerald-700">{msg}</p>}
    </div>
  );
}
