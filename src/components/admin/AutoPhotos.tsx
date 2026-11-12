"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminAutoPhoto } from "@/app/actions/admin";
import { useT } from "@/components/LangProvider";

/** One tap: finds a photo for every model that has none (uses the photo-search key). */
export function AutoPhotos({ ids, ready }: { ids: number[]; ready: boolean }) {
  const t = useT();
  const router = useRouter();
  const [run, setRun] = useState<{ at: number; found: number; failed: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ids.length && !run) return null;
  if (!ready) {
    return (
      <p className="rounded-xl bg-gold-50 px-3.5 py-2.5 text-sm text-gold-900 ring-1 ring-gold-200">
        {t("{n} models have no photo.", { n: ids.length })}{" "}
        <Link href="/admin/settings#photos" className="font-semibold underline">
          {t("Turn on photo search")}
        </Link>{" "}
        {t("to add them all in one tap.")}
      </p>
    );
  }

  const start = async () => {
    setBusy(true);
    setMsg(null);
    let found = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      setRun({ at: i + 1, found, failed });
      const r = await adminAutoPhoto(ids[i]);
      if (!r.ok) {
        setMsg(t(r.error));
        break;
      }
      if (r.image) found++;
      else failed++;
      if (i % 5 === 4) router.refresh();
    }
    setRun((x) => (x ? { ...x, found, failed } : x));
    setBusy(false);
    setMsg(t("{f} photos added. {n} not found — add those by hand.", { f: found, n: failed }));
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm ring-1 ring-brand-100">
      <span className="text-brand-900">
        {busy && run
          ? t("Finding photos… {a} of {n}", { a: run.at, n: ids.length })
          : msg ?? t("{n} models have no photo.", { n: ids.length })}
      </span>
      {!busy && ids.length > 0 && (
        <button type="button" className="btn btn-primary btn-sm" onClick={start}>
          <ImagePlus className="size-4" /> {t("Auto-add photos")}
        </button>
      )}
      {busy && <LoaderCircle className="size-4 animate-spin text-brand-700" />}
    </div>
  );
}
