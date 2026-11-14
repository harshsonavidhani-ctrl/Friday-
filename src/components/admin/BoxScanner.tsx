"use client";

import { Camera, Check, LoaderCircle, RotateCcw, ScanText } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/components/LangProvider";
import { parseBoxText, type BoxResult } from "@/lib/box-text";

/**
 * "Scan the box": Papa photographs the spec label on a phone box; the text is read
 * ON THE PHONE (Tesseract OCR — free, no account, the photo is not uploaded) and
 * turned into specs + a short description for him to check before saving.
 */
export function BoxScanner({ brand, model, onApply }: { brand: string; model: string; onApply: (r: BoxResult) => void }) {
  const t = useT();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | number>(null); // progress 0–100 while reading
  const [result, setResult] = useState<BoxResult | null>(null);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");

  async function read(file: File | undefined) {
    if (!file) return;
    setErr("");
    setResult(null);
    setBusy(0);
    try {
      const img = await prepare(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setBusy(Math.round(10 + m.progress * 90));
          else setBusy((p) => (p === null ? 0 : Math.max(p, Math.round(m.progress * 10))));
        },
      });
      const { data } = await worker.recognize(img);
      await worker.terminate();
      setRaw(data.text);
      const r = parseBoxText(data.text, brand, model);
      if (!r.specs.length) setErr(t("Could not read specs from this photo. Take it closer, flat and in good light, with only the spec label in the photo."));
      else setResult(r);
    } catch (e) {
      setErr(`${t("Could not read the photo.")} ${(e as Error).message || ""}`.trim());
    } finally {
      setBusy(null);
      if (camRef.current) camRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-200">
      <div className="flex items-start gap-3">
        <ScanText className="mt-0.5 size-6 shrink-0 text-gold-700" />
        <div className="min-w-0">
          <p className="font-bold text-brand-950">{t("Scan the box")}</p>
          <p className="text-sm text-slate-600">{t("Take a photo of the spec label on the phone's box — RAM, display, camera, battery, MRP fill in by themselves.")}</p>
        </div>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => read(e.target.files?.[0])} aria-label={t("Box photo (camera)")} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => read(e.target.files?.[0])} aria-label={t("Box photo (gallery)")} />

      {busy !== null ? (
        <div className="space-y-2" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
            <LoaderCircle className="size-4 animate-spin" /> {t("Reading the box… {n}%", { n: busy })}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-gold-100">
            <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${busy}%` }} />
          </div>
          <p className="text-xs text-slate-500">{t("The first time takes a little longer (the reader downloads once).")}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => camRef.current?.click()} className="btn btn-gold">
            <Camera className="size-4" /> {result ? t("Scan again") : t("Take photo of box")}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-outline btn-sm">
            {t("Choose from gallery")}
          </button>
        </div>
      )}

      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">{err}</p>}

      {result && (
        <div className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-sm font-bold text-emerald-700">{t("Found {n} details — please check:", { n: result.specs.length })}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {result.specs.map((s) => (
              <div key={s.label} className="contents">
                <dt className="text-slate-500">{t(s.label)}</dt>
                <dd className="font-semibold text-slate-900">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onApply(result);
                setResult(null);
              }}
              className="btn btn-success"
            >
              <Check className="size-4" /> {t("Use these details")}
            </button>
            <button type="button" onClick={() => setResult(null)} className="btn btn-outline btn-sm">
              <RotateCcw className="size-4" /> {t("Cancel")}
            </button>
          </div>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">{t("Show the text that was read")}</summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 whitespace-pre-wrap">{raw}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

/** Shrink big camera photos, make them grey and sharper — OCR reads labels better. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.filter = "grayscale(1) contrast(1.35)";
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}
