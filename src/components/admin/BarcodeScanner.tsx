"use client";

import { CircleCheck, CircleX, Flashlight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";

type Detected = { rawValue: string };
type Detector = { detect: (src: HTMLVideoElement) => Promise<Detected[]> };
type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

// IMEI / serial barcodes on boxes are Code-128 (sometimes Code-39 / QR). Product
// barcodes (EAN-13) are left out on purpose so they are never picked by mistake.
const FORMATS = ["code_128", "code_39", "code_93", "itf", "qr_code", "data_matrix"];

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1046 : 220;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.09 : 0.25));
    o.onended = () => void ctx.close();
  } catch {
    /* no sound is fine */
  }
}

export type ScanOutcome = { ok: boolean; message: string; done?: boolean };

/**
 * Full-screen camera scanner. Keeps scanning box after box until closed.
 * `onCode` saves the code and says if it worked.
 */
export function BarcodeScanner({
  title,
  onCode,
  onClose,
}: {
  title: string;
  onCode: (code: string) => Promise<ScanOutcome>;
  onClose: () => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const handler = useRef(onCode);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<{ text: string; ok: boolean; at: number }[]>([]);
  const [torch, setTorch] = useState<null | { on: boolean; set: (on: boolean) => Promise<void> }>(null);

  useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stopped = false;
    let stop = () => {};
    const busy = { v: false };
    const seen = new Map<string, number>();

    const handle = async (raw: string) => {
      const code = raw.trim();
      const now = Date.now();
      if (!code || busy.v || (seen.get(code) ?? 0) > now - 3000) return;
      seen.set(code, now);
      busy.v = true;
      try {
        const r = await handler.current(code);
        navigator.vibrate?.(r.ok ? 60 : [80, 60, 80]);
        beep(r.ok);
        setLog((l) => [{ text: r.message, ok: r.ok, at: now }, ...l].slice(0, 6));
        if (r.done) setTimeout(() => !stopped && onClose(), 900);
      } finally {
        busy.v = false;
      }
    };

    (async () => {
      await Promise.resolve();
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(t("The camera works only on the live website (https). Type the IMEI instead."));
        return;
      }
      const el = video.current!;
      const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      if (BD) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        el.srcObject = stream;
        await el.play();
        const supported = await BD.getSupportedFormats();
        const det = new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
        let timer: ReturnType<typeof setTimeout>;
        const tick = async () => {
          if (stopped) return;
          try {
            if (el.readyState >= 2) for (const c of await det.detect(el)) await handle(c.rawValue);
          } catch {
            /* frame not ready */
          }
          timer = setTimeout(tick, 120);
        };
        tick();
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (caps.torch) {
          const set = async (on: boolean) => {
            await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
            setTorch({ on, set });
          };
          setTorch({ on: false, set });
        }
        stop = () => {
          clearTimeout(timer);
          stream.getTracks().forEach((tr) => tr.stop());
        };
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false },
          el,
          (result) => {
            if (result) void handle(result.getText());
          },
        );
        if (stopped) controls.stop();
        stop = () => controls.stop();
      }
    })().catch((e: Error) => {
      setError(
        e?.name === "NotAllowedError"
          ? t("Camera permission was denied. Allow the camera for this website, or type the IMEI.")
          : t("Could not start the camera. Type the IMEI instead."),
      );
    });

    return () => {
      stopped = true;
      stop();
    };
  }, [onClose, t]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal aria-label={title}>
      <div className="flex items-center justify-between gap-2 bg-black/80 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
        <div className="flex items-center gap-2">
          {torch && (
            <button
              type="button"
              onClick={() => torch.set(!torch.on)}
              className={`rounded-lg p-2 ${torch.on ? "bg-gold-400 text-brand-950" : "bg-white/10"}`}
              aria-label={t("Torch")}
            >
              <Flashlight className="size-5" />
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">
            <X className="mr-1 inline size-4" />
            {t("Done")}
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} className="absolute inset-0 size-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-[82%] max-w-md rounded-2xl border-4 border-gold-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        <p className="absolute inset-x-0 top-4 text-center text-sm font-semibold text-white drop-shadow">
          {t("Point at the IMEI 1 barcode on the box")}
        </p>
        {error && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 text-center text-sm font-medium text-slate-800">
            {error}
          </div>
        )}
      </div>
      <ul className="space-y-1.5 bg-black/90 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {log.length === 0 && <li className="text-center text-sm text-white/60">{t("Scanned numbers will show here")}</li>}
        {log.map((l) => (
          <li key={l.at} className={`flex items-center gap-2 text-sm font-semibold ${l.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {l.ok ? <CircleCheck className="size-4 shrink-0" /> : <CircleX className="size-4 shrink-0" />}
            <span className="num min-w-0 truncate">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
