"use client";

import { ArrowRight, Check, FileDown, FileSpreadsheet, LoaderCircle, PackagePlus, RotateCcw, TriangleExclamationPoint, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { bulkUpdateVariants, type VariantChange } from "@/app/actions/admin";
import { importNewProducts, readImportFile, type NewModelRow } from "@/app/actions/import";
import { useT } from "@/components/LangProvider";
import { formatINR } from "@/lib/format";
import {
  buildIndex,
  colName,
  findHeader,
  guessMapping,
  matchRow,
  readRows,
  type Field,
  type ImportRow,
  type Mapping,
  type VariantRef,
} from "@/lib/import-match";

type Choice = number | "new" | "skip"; // variant id, add as new model, or ignore
type Filter = "changes" | "check" | "missing" | "all";

const FIELD_LABEL: Record<Field, string> = {
  id: "ID (from our Excel)",
  name: "Model name *",
  variant: "Variant (RAM / storage)",
  model: "Model number",
  price: "Wholesale price",
  mrp: "MRP",
  stock: "Stock (pieces)",
};

export function ImportTool({ variants }: { variants: VariantRef[] }) {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, startRead] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ rows: string[][]; name: string } | null>(null);
  const [header, setHeader] = useState<{ index: number; headers: string[] }>({ index: 0, headers: [] });
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [upd, setUpd] = useState({ price: true, stock: true, mrp: false });
  const [choice, setChoice] = useState<Record<number, Choice>>({});
  const [filter, setFilter] = useState<Filter>("changes");
  const [limit, setLimit] = useState(150);
  const [editing, setEditing] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [costRate, setCostRate] = useState(false);

  const idx = useMemo(() => buildIndex(variants), [variants]);
  const sorted = useMemo(() => [...variants].sort((a, b) => `${a.name} ${a.label}`.localeCompare(`${b.name} ${b.label}`)), [variants]);

  const lines = useMemo(() => {
    if (!sheet || !mapping || mapping.name < 0) return [];
    const rows = readRows(sheet.rows, header.index, mapping);
    const used = new Map<number, number>(); // variant id → last line using it
    const out = rows.map((r) => {
      const m = matchRow(idx, { id: r.idCell, text: r.text, model: r.model });
      const c = choice[r.line];
      const ref = typeof c === "number" ? idx.byId.get(c) : c === "new" || c === "skip" ? undefined : m?.ref;
      if (ref) used.set(ref.id, r.line);
      return { r, m, c, ref };
    });
    return out.map((x) => {
      const dup = !!x.ref && used.get(x.ref.id) !== x.r.line;
      const newPrice = upd.price && x.ref && x.r.price !== null && x.r.price !== x.ref.price ? x.r.price : undefined;
      const newStock = upd.stock && x.ref && x.r.stock !== null && x.r.stock !== x.ref.stock ? x.r.stock : undefined;
      const newMrp = upd.mrp && x.ref && x.r.mrp !== null && x.r.mrp !== x.ref.mrp ? x.r.mrp : undefined;
      const change = !dup && x.c !== "skip" && (newPrice !== undefined || newStock !== undefined || newMrp !== undefined);
      const status: "match" | "check" | "missing" | "new" | "skip" =
        x.c === "skip" ? "skip" : x.c === "new" ? "new" : !x.ref ? "missing" : typeof x.c === "number" || x.m?.confidence !== "check" ? "match" : "check";
      return { ...x, dup, newPrice, newStock, newMrp, change, status };
    });
  }, [sheet, mapping, header.index, idx, choice, upd]);

  const counts = useMemo(
    () => ({
      all: lines.length,
      changes: lines.filter((l) => l.change || l.status === "new").length,
      check: lines.filter((l) => l.status === "check").length,
      missing: lines.filter((l) => l.status === "missing").length,
      matched: lines.filter((l) => l.ref).length,
      newModels: lines.filter((l) => l.status === "new").length,
      priceChanges: lines.filter((l) => l.change && l.newPrice !== undefined).length,
      stockChanges: lines.filter((l) => l.change && l.newStock !== undefined).length,
    }),
    [lines],
  );

  const shown = lines.filter((l) =>
    filter === "all" ? true : filter === "changes" ? l.change || l.status === "new" : filter === "check" ? l.status === "check" : l.status === "missing",
  );

  function upload(file: File) {
    setError(null);
    setDone(null);
    const fd = new FormData();
    fd.set("file", file);
    startRead(async () => {
      const r = await readImportFile(fd);
      if ("error" in r) return setError(t(r.error));
      const h = findHeader(r.rows);
      const g = guessMapping(h.headers);
      // Tally's "Closing Balance → Rate" is the stock value (cost), not the selling rate
      const cost = g.price >= 0 && /closing|value|cost|purchase/i.test(h.headers[g.price] ?? "");
      setSheet({ rows: r.rows, name: file.name });
      setHeader(h);
      setMapping(g);
      setCostRate(cost);
      setUpd({ price: !cost, stock: true, mrp: false });
      setChoice({});
      setFilter("changes");
      setLimit(150);
    });
  }

  function apply() {
    const changes: VariantChange[] = lines
      .filter((l) => l.change && l.ref)
      .map((l) => ({
        id: l.ref!.id,
        ...(l.newPrice !== undefined ? { price: l.newPrice } : {}),
        ...(l.newStock !== undefined ? { stock: l.newStock } : {}),
        ...(l.newMrp !== undefined ? { mrp: l.newMrp } : {}),
      }));
    const fresh: NewModelRow[] = lines
      .filter((l) => l.status === "new")
      .map((l) => ({
        name: mapping && mapping.variant >= 0 ? l.r.text.replace(l.r.variantCell, "").trim() : l.r.text,
        label: l.r.variantCell,
        modelNumber: l.r.model,
        price: l.r.price ?? 0,
        mrp: l.r.mrp,
        stock: l.r.stock ?? 0,
      }));
    startSave(async () => {
      setError(null);
      const parts: string[] = [];
      for (let i = 0; i < changes.length; i += 1500) {
        const r = await bulkUpdateVariants(changes.slice(i, i + 1500));
        if (!r.ok) return setError(t(r.error));
      }
      if (changes.length) parts.push(t("{n} models updated", { n: changes.length }));
      if (fresh.length) {
        const r = await importNewProducts(fresh);
        if ("error" in r) return setError(t(r.error));
        parts.push(t("{n} new models added (add photos later)", { n: r.products }));
      }
      setDone(parts.join(" · ") || t("Nothing to change"));
      setSheet(null);
      setMapping(null);
      router.refresh();
    });
  }

  // ───────────── screens ─────────────

  if (!sheet || !mapping) {
    return (
      <div className="space-y-4">
        {done && (
          <div className="card flex flex-wrap items-center gap-3 bg-emerald-50 p-4 ring-emerald-200">
            <Check className="size-6 text-emerald-600" />
            <p className="flex-1 font-semibold text-emerald-900">{done}</p>
            <Link href="/admin/prices" className="btn btn-success btn-sm">
              {t("See prices")} <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={reading}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) upload(f);
          }}
          className="card flex w-full flex-col items-center gap-3 border-2 border-dashed border-brand-200 p-8 text-center hover:border-brand-400 hover:bg-brand-50/40"
        >
          {reading ? <LoaderCircle className="size-10 animate-spin text-brand-700" /> : <Upload className="size-10 text-brand-700" />}
          <span className="text-lg font-bold text-brand-950">{reading ? t("Reading file…") : t("Upload Excel / Tally file")}</span>
          <span className="text-sm text-slate-500">{t(".xlsx or .csv — you will see every change before anything is saved")}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-2 p-4">
            <h2 className="flex items-center gap-2 font-bold text-brand-950">
              <FileDown className="size-4" /> {t("Easiest: use our Excel")}
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>{t("Download today's price list as Excel.")}</li>
              <li>{t("Change prices / stock in Excel (do not change the ID column).")}</li>
              <li>{t("Upload it here — matched 100% by ID.")}</li>
            </ol>
            <a href="/api/admin/export/prices" className="btn btn-outline btn-sm">
              <FileSpreadsheet className="size-4" /> {t("Download price list (.xlsx)")}
            </a>
          </section>
          <section className="card space-y-2 p-4">
            <h2 className="flex items-center gap-2 font-bold text-brand-950">
              <FileSpreadsheet className="size-4" /> {t("From Tally")}
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>{t("Tally → Display More Reports → Stock Summary (or Price List).")}</li>
              <li>{t("Press Alt+E (Export) → Format: Excel → Export.")}</li>
              <li>{t("Upload the file here. Rows are matched by model name, RAM and storage.")}</li>
            </ol>
          </section>
        </div>
      </div>
    );
  }

  const opts = header.headers.map((h, i) => ({ i, label: `${colName(i)}${h ? ` · ${h.slice(0, 30)}` : ""}` }));

  return (
    <div className="space-y-4 pb-24">
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
            <FileSpreadsheet className="mr-1 inline size-4 text-emerald-600" /> {sheet.name} ·{" "}
            <span className="text-slate-500">{t("{n} rows found", { n: lines.length })}</span>
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setSheet(null), setMapping(null))}>
            <RotateCcw className="size-4" /> {t("Other file")}
          </button>
        </div>
        <p className="text-xs text-slate-500">{t("Check which column is which (we guessed):")}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(["name", "variant", "price", "stock", "mrp", "model", "id"] as Field[]).map((f) => (
            <label key={f} className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">{t(FIELD_LABEL[f])}</span>
              <select
                className="input py-2 text-sm"
                value={mapping[f]}
                onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}
              >
                <option value={-1}>{t("— not in file —")}</option>
                {opts.map((o) => (
                  <option key={o.i} value={o.i}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {costRate && (
          <p className="rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-900 ring-1 ring-gold-200">
            {t("The “Rate” in a Tally Stock Summary is your stock value (cost), not the selling rate — so Prices are not ticked. Tick Prices only if that column has your wholesale rate.")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-sm">
          <span className="font-semibold text-slate-700">{t("Update:")}</span>
          {(["price", "stock", "mrp"] as const).map((k) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-brand-800" checked={upd[k]} onChange={(e) => setUpd({ ...upd, [k]: e.target.checked })} />
              {t(k === "price" ? "Prices" : k === "stock" ? "Stock" : "MRP")}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label={t("Matched")} value={counts.matched} tone="text-emerald-700" />
        <Count label={t("Price changes")} value={counts.priceChanges} tone="text-brand-900" />
        <Count label={t("Stock changes")} value={counts.stockChanges} tone="text-brand-900" />
        <Count label={t("Not found")} value={counts.missing} tone={counts.missing ? "text-gold-700" : "text-slate-500"} />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            ["changes", t("Changes"), counts.changes],
            ["check", t("Please check"), counts.check],
            ["missing", t("Not found"), counts.missing],
            ["all", t("All rows"), counts.all],
          ] as [Filter, string, number][]
        ).map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => (setFilter(k), setLimit(150))} className={`chip ${filter === k ? "chip-active" : ""}`}>
            {label} <span className="num text-xs opacity-70">{n}</span>
          </button>
        ))}
        {filter === "missing" && counts.missing > 0 && (
          <button
            type="button"
            className="chip"
            onClick={() =>
              setChoice((c) => {
                const next = { ...c };
                for (const l of lines) if (l.status === "missing" && l.r.price) next[l.r.line] = "new";
                return next;
              })
            }
          >
            <PackagePlus className="size-4" /> {t("Add all as new models")}
          </button>
        )}
      </div>

      <ul className="card divide-y divide-slate-100">
        {shown.slice(0, limit).map((l) => (
          <li key={l.r.line} className={`space-y-1.5 p-3 sm:p-4 ${l.status === "skip" ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm text-slate-500">
                <span className="num text-xs text-slate-400">#{l.r.line}</span> {l.r.text}
              </p>
              <StatusBadge status={l.status} dup={l.dup} />
            </div>
            {l.ref && (
              <p className="text-sm font-semibold text-slate-900">
                → {l.ref.name}
                {l.ref.label && <span className="font-normal text-slate-500"> · {l.ref.label}</span>}
              </p>
            )}
            {l.ref && (l.newPrice !== undefined || l.newStock !== undefined || l.newMrp !== undefined) && !l.dup && (
              <div className="num flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {l.newPrice !== undefined && <Diff label={t("Price")} from={l.ref.price} to={l.newPrice} money />}
                {l.newStock !== undefined && <Diff label={t("Stock")} from={l.ref.stock} to={l.newStock} />}
                {l.newMrp !== undefined && <Diff label="MRP" from={l.ref.mrp ?? 0} to={l.newMrp} money />}
              </div>
            )}
            {l.ref && !l.change && !l.dup && l.status !== "skip" && <p className="text-xs text-slate-400">{t("No change")}</p>}
            {l.status === "new" && (
              <p className="num text-sm text-brand-800">
                {t("Will be added as a new model")} · {l.r.price ? formatINR(l.r.price) : "—"} · {t("{n} pcs", { n: l.r.stock ?? 0 })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {editing === l.r.line ? (
                <select
                  autoFocus
                  className="input max-w-full py-1.5 text-sm sm:max-w-md"
                  value={typeof l.c === "number" ? l.c : (l.ref?.id ?? "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChoice((c) => ({ ...c, [l.r.line]: v === "new" || v === "skip" ? v : Number(v) }));
                    setEditing(null);
                  }}
                  onBlur={() => setEditing(null)}
                >
                  <option value="">{t("Choose model…")}</option>
                  <option value="new">➕ {t("Add as new model")}</option>
                  <option value="skip">✕ {t("Ignore this row")}</option>
                  {sorted.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.label && `· ${v.label}`}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(l.r.line)}>
                    {l.ref ? t("Change match") : t("Choose model")}
                  </button>
                  {l.status === "missing" && l.r.price !== null && (
                    <button type="button" className="btn btn-ghost btn-sm text-brand-700" onClick={() => setChoice((c) => ({ ...c, [l.r.line]: "new" }))}>
                      <PackagePlus className="size-4" /> {t("Add as new model")}
                    </button>
                  )}
                  {l.status !== "skip" && (
                    <button type="button" className="btn btn-ghost btn-sm text-slate-500" onClick={() => setChoice((c) => ({ ...c, [l.r.line]: "skip" }))}>
                      {t("Ignore")}
                    </button>
                  )}
                  {(l.status === "skip" || l.status === "new" || typeof l.c === "number") && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-slate-500"
                      onClick={() =>
                        setChoice((c) => {
                          const n = { ...c };
                          delete n[l.r.line];
                          return n;
                        })
                      }
                    >
                      <RotateCcw className="size-3.5" /> {t("Undo")}
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="p-8 text-center text-sm text-slate-500">{t("Nothing here.")}</li>}
        {shown.length > limit && (
          <li className="p-3 text-center">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setLimit((n) => n + 300)}>
              {t("Show more ({n} left)", { n: shown.length - limit })}
            </button>
          </li>
        )}
      </ul>

      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">{error}</p>}

      <div className="fixed inset-x-0 bottom-[calc(4rem+var(--badge,0px))] z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:bottom-[var(--badge,0px)] lg:left-[260px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <b className="num text-slate-900">{counts.changes}</b> {t("changes ready")}
          </p>
          <button type="button" className="btn btn-primary" disabled={saving || counts.changes === 0} onClick={apply}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {t("Save all changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`num text-xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

function Diff({ label, from, to, money }: { label: string; from: number; to: number; money?: boolean }) {
  const f = money ? formatINR : (n: number) => String(n);
  const up = to > from;
  return (
    <span className="text-slate-600">
      {label}: <s className="text-slate-400">{f(from)}</s> → <b className={up ? "text-emerald-700" : "text-rose-700"}>{f(to)}</b>
    </span>
  );
}

function StatusBadge({ status, dup }: { status: string; dup: boolean }) {
  const t = useT();
  if (dup) return <span className="badge shrink-0 bg-slate-100 text-slate-600 ring-slate-200">{t("Repeated row")}</span>;
  const map: Record<string, [string, string]> = {
    match: ["bg-emerald-50 text-emerald-700 ring-emerald-200", "Matched"],
    check: ["bg-gold-50 text-gold-800 ring-gold-200", "Please check"],
    missing: ["bg-slate-100 text-slate-600 ring-slate-200", "Not found"],
    new: ["bg-brand-50 text-brand-800 ring-brand-200", "New model"],
    skip: ["bg-slate-100 text-slate-500 ring-slate-200", "Ignored"],
  };
  const [cls, label] = map[status] ?? map.missing;
  return (
    <span className={`badge shrink-0 ${cls}`}>
      {status === "check" && <TriangleExclamationPoint className="size-3" />}
      {t(label)}
    </span>
  );
}

export type { ImportRow };
