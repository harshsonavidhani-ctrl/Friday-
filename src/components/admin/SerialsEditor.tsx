"use client";

import { Camera, LoaderCircle, Plus, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { adminAddSerials, adminRemoveSerial } from "@/app/actions/admin";
import { useT } from "@/components/LangProvider";
import type { ScanOutcome } from "./BarcodeScanner";

const BarcodeScanner = dynamic(() => import("./BarcodeScanner").then((m) => m.BarcodeScanner), { ssr: false });

type Line = { id: number; name: string; variantLabel: string; qty: number; serials: { id: number; serial: string }[] };

/** IMEI / serial numbers per order line — scan with the camera or type. */
export function SerialsEditor({ items, editable }: { items: Line[]; editable: boolean }) {
  const t = useT();
  const total = items.reduce((s, i) => s + i.qty, 0);
  const done = items.reduce((s, i) => s + Math.min(i.qty, i.serials.length), 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <span className="num text-xs font-semibold text-slate-600">{t("{n} of {q} recorded", { n: done, q: total })}</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <SerialLine key={it.id} line={it} editable={editable} />
        ))}
      </ul>
    </div>
  );
}

function SerialLine({ line, editable }: { line: Line; editable: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scan, setScan] = useState(false);
  // server count, updated right away from each save and again after refresh
  const [count, setCount] = useState(line.serials.length);
  const [seenLen, setSeenLen] = useState(line.serials.length);
  if (seenLen !== line.serials.length) {
    setSeenLen(line.serials.length);
    setCount(line.serials.length);
  }
  const left = Math.max(0, line.qty - count);

  const add = (codes: string[]) =>
    start(async () => {
      const r = await adminAddSerials(line.id, codes);
      if (!r.ok) return setMsg({ ok: false, text: t(r.error) });
      const bad = r.results.filter((x) => !x.ok);
      const good = r.results.filter((x) => x.ok);
      const last = good.at(-1);
      if (last?.count !== undefined) setCount(last.count);
      setMsg(bad.length ? { ok: false, text: bad.map((b) => b.message).join(" · ") } : { ok: true, text: good.map((g) => g.message).join(" · ") });
      if (good.length) setValue("");
      router.refresh();
    });

  const onScanCode = useCallback(
    async (code: string): Promise<ScanOutcome> => {
      const r = await adminAddSerials(line.id, [code]);
      if (!r.ok) return { ok: false, message: t(r.error) };
      const x = r.results[0];
      if (x?.ok) {
        if (x.count !== undefined) setCount(x.count);
        router.refresh();
        return { ok: true, message: x.message, done: (x.count ?? 0) >= (x.qty ?? Infinity) };
      }
      return { ok: false, message: x?.message ?? t("Could not add") };
    },
    [line.id, router, t],
  );
  const closeScan = useCallback(() => setScan(false), []);

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{line.name}</p>
          {line.variantLabel && <p className="text-xs text-slate-500">{line.variantLabel}</p>}
        </div>
        <span
          className={`badge num shrink-0 ${
            count >= line.qty ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
          }`}
        >
          {count} / {line.qty}
        </span>
      </div>

      {line.serials.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {line.serials.map((s) => (
            <li key={s.id} className="num inline-flex items-center gap-1 rounded-lg bg-slate-100 py-1 pr-1 pl-2 text-xs font-semibold text-slate-800">
              {s.serial}
              {editable && (
                <button
                  type="button"
                  className="rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                  aria-label={t("Remove")}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await adminRemoveSerial(s.id);
                      router.refresh();
                    })
                  }
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {line.serials.length > line.qty && (
        <p className="text-xs font-semibold text-gold-700">{t("More IMEIs than pieces — remove the extra ones.")}</p>
      )}

      {editable && left > 0 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const codes = value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
            if (codes.length) add(codes);
          }}
        >
          <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => setScan(true)}>
            <Camera className="size-4" /> {t("Scan")}
          </button>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input num min-w-0 flex-1 py-1.5 text-sm"
            placeholder={t("Type IMEI / serial no.")}
            inputMode="text"
            autoCapitalize="characters"
            aria-label={t("IMEI / serial number")}
          />
          <button type="submit" className="btn btn-outline btn-sm shrink-0" disabled={pending || !value.trim()}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} {t("Add")}
          </button>
        </form>
      )}
      {msg && <p className={`text-xs font-semibold ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}

      {scan && (
        <BarcodeScanner
          title={`${t("Scan IMEI")}: ${line.name} ${line.variantLabel}`.trim()}
          onCode={onScanCode}
          onClose={closeScan}
        />
      )}
    </li>
  );
}
