"use client";

import { Camera, Check, ExternalLink, Images, Link as LinkIcon, LoaderCircle, RefreshCw, Search, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";
import type { ImageResult } from "@/lib/image-search";

/** Shrinks phone photos before upload (faster on mobile data). */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error())), "image/jpeg", 0.86));
  } catch {
    return file;
  }
}

export async function saveImageFromUrl(url: string, fallback?: string): Promise<string> {
  const r = await fetch("/api/admin/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, fallback }),
  });
  const d = (await r.json()) as { url?: string; error?: string };
  if (!r.ok || !d.url) throw new Error(d.error || "Could not save photo");
  return d.url;
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", await compress(file), "photo.jpg");
  const r = await fetch("/api/admin/images", { method: "POST", body: fd });
  const d = (await r.json()) as { url?: string; error?: string };
  if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
  return d.url;
}

export type SearchState = {
  query: string;
  results: ImageResult[];
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
};

export function PhotoPicker({
  images,
  setImages,
  search,
  onSearch,
  query,
  autoPick,
}: {
  images: string[];
  setImages: (fn: (prev: string[]) => string[]) => void;
  search: SearchState;
  onSearch: (q: string) => void;
  query: string;
  autoPick: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState<Record<string, "saving" | "failed">>({});
  const [picked, setPicked] = useState<Record<string, string>>({}); // result.full -> saved url
  const [uploading, setUploading] = useState(0);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  async function pick(r: ImageResult): Promise<boolean> {
    const saved = picked[r.full];
    if (saved) {
      // tapping again removes it
      setImages((prev) => prev.filter((u) => u !== saved));
      setPicked((p) => {
        const n = { ...p };
        delete n[r.full];
        return n;
      });
      return false;
    }
    if (busy[r.full] === "saving") return false;
    setBusy((b) => ({ ...b, [r.full]: "saving" }));
    try {
      const url = await saveImageFromUrl(r.full, r.thumb);
      setImages((prev) => (prev.length >= 8 ? prev : [...prev, url]));
      setPicked((p) => ({ ...p, [r.full]: url }));
      setBusy((b) => {
        const n = { ...b };
        delete n[r.full];
        return n;
      });
      return true;
    } catch {
      setBusy((b) => ({ ...b, [r.full]: "failed" }));
      return false;
    }
  }

  // New model: as soon as photos arrive, save the best one automatically
  // (tries the next result if a website blocks the download).
  const autoDone = useRef<ImageResult[] | null>(null);
  const noImagesYet = images.length === 0;
  useEffect(() => {
    if (!autoPick || !noImagesYet || !search.results.length || autoDone.current === search.results) return;
    autoDone.current = search.results;
    const list = search.results.slice(0, 4);
    void Promise.resolve().then(async () => {
      for (const r of list) if (await pick(r)) break;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPick, noImagesYet, search.results]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setMsg(null);
    for (const f of Array.from(files).slice(0, 8)) {
      setUploading((n) => n + 1);
      try {
        const url = await uploadFile(f);
        setImages((prev) => (prev.length >= 8 ? prev : [...prev, url]));
      } catch (e) {
        setMsg(t((e as Error).message));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function addLink() {
    if (!link.trim()) return;
    setMsg(null);
    setUploading((n) => n + 1);
    try {
      const url = await saveImageFromUrl(link.trim());
      setImages((prev) => [...prev, url]);
      setLink("");
    } catch (e) {
      setMsg(t((e as Error).message));
    } finally {
      setUploading((n) => n - 1);
    }
  }

  function remove(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
    setPicked((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== url)));
  }

  return (
    <div className="space-y-4">
      {/* Chosen photos */}
      {(images.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={url} className="group relative size-24 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 sm:size-28">
              <img src={url} alt="" className="size-full object-contain p-1" />
              {i === 0 ? (
                <span className="absolute bottom-1 left-1 rounded-md bg-brand-900 px-1.5 py-0.5 text-[10px] font-bold text-white">{t("Main")}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setImages((prev) => [url, ...prev.filter((u) => u !== url)])}
                  className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200"
                >
                  <Star className="size-3" /> {t("Main")}
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute top-1 right-1 rounded-full bg-slate-900/70 p-1 text-white"
                aria-label={t("Remove photo")}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {uploading > 0 && (
            <div className="flex size-24 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200 sm:size-28">
              <LoaderCircle className="size-6 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      )}

      {/* Internet photo results */}
      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Images className="size-4" />
            {search.query ? t("Photos for “{q}”", { q: search.query }) : t("Photos from the internet")}
          </p>
          <button
            type="button"
            onClick={() => onSearch(query)}
            disabled={query.trim().length < 2 || search.loading}
            className="btn btn-outline btn-sm"
          >
            {search.loading ? <LoaderCircle className="size-4 animate-spin" /> : search.query ? <RefreshCw className="size-4" /> : <Search className="size-4" />}
            {search.query ? t("Search again") : t("Find photos")}
          </button>
        </div>

        {search.notConfigured ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              {t("Automatic photo search is not switched on yet. Add a free Brave Search key in")}{" "}
              <a href="/admin/settings#photos" className="font-semibold text-brand-700 underline">
                {t("Settings")}
              </a>
              . {t("Until then, use the buttons below.")}
            </p>
            {query.trim().length > 1 && (
              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
              >
                <ExternalLink className="size-4" /> {t("Open Google Images")}
              </a>
            )}
          </div>
        ) : search.error ? (
          <p className="text-sm text-rose-600">{search.error}</p>
        ) : search.loading && !search.results.length ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : search.results.length ? (
          <>
            <p className="mb-2 text-xs text-slate-500">{t("Tap a photo to add it. Tap again to remove.")}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {search.results.slice(0, 18).map((r) => {
                const state = picked[r.full] ? "picked" : busy[r.full];
                return (
                  <button
                    key={r.full}
                    type="button"
                    onClick={() => pick(r)}
                    title={r.title}
                    className={`relative aspect-square overflow-hidden rounded-xl bg-white ring-2 transition ${
                      state === "picked" ? "ring-emerald-500" : state === "failed" ? "ring-rose-300 opacity-50" : "ring-transparent hover:ring-brand-300"
                    }`}
                  >
                    <img src={r.thumb} alt={r.title} loading="lazy" className="size-full object-contain p-1" referrerPolicy="no-referrer" />
                    {state === "saving" && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <LoaderCircle className="size-6 animate-spin text-brand-700" />
                      </span>
                    )}
                    {state === "picked" && (
                      <span className="absolute top-1 right-1 rounded-full bg-emerald-500 p-0.5 text-white">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    )}
                    {state === "failed" && (
                      <span className="absolute inset-x-0 bottom-0 bg-rose-600 py-0.5 text-[10px] font-semibold text-white">{t("Blocked")}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">{t("Type the model name above — matching photos will appear here automatically.")}</p>
        )}
      </div>

      {/* Own photos */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => camRef.current?.click()}>
          <Camera className="size-4" /> {t("Take photo")}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
          <Images className="size-4" /> {t("From gallery")}
        </button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder={t("Or paste a photo link (long-press photo → Copy image address)")}
            className="input py-2 pl-9 text-sm"
          />
        </div>
        <button type="button" onClick={addLink} className="btn btn-outline btn-sm" disabled={!link.trim()}>
          {t("Add")}
        </button>
      </div>
      {msg && <p className="text-sm text-rose-600">{msg}</p>}
    </div>
  );
}
