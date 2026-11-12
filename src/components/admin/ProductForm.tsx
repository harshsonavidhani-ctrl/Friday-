"use client";

import { Check, ChevronDown, CircleCheck, Eye, LoaderCircle, Plus, Sparkles, Trash, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveProduct, type ProductInput } from "@/app/actions/admin";
import { PhotoPicker, type SearchState } from "@/components/admin/PhotoPicker";
import { useT } from "@/components/LangProvider";
import {
  categoryKeyFromName,
  detectBrand,
  detectCategoryKey,
  findCategoryId,
  parseVariant,
  SPEC_TEMPLATES,
  VARIANT_CHIPS,
} from "@/lib/detect";
import type { ImageResult } from "@/lib/image-search";

type Cat = { id: number; name: string };
type VRow = { key: string; id?: number; label: string; kind: "fresh" | "activated"; modelNumber: string; price: string; mrp: string; stock: string };
type SRow = { key: string; label: string; value: string };

let seq = 0;
const k = () => `r${++seq}`;
const emptyVariant = (label = ""): VRow => ({ key: k(), label, kind: "fresh", modelNumber: "", price: "", mrp: "", stock: "" });
const toNum = (s: string) => Number(s.replace(/[,₹\s]/g, "")) || 0;
const specRows = (labels: string[]): SRow[] => labels.map((label) => ({ key: k(), label, value: "" }));

const EMPTY_SEARCH: SearchState = { query: "", results: [], loading: false, error: null, notConfigured: false };

export function ProductForm({
  cats,
  brands,
  initial,
}: {
  cats: Cat[];
  brands: string[];
  initial?: ProductInput & { id: number };
}) {
  const t = useT();
  const router = useRouter();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [brandTouched, setBrandTouched] = useState(isEdit);
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [catTouched, setCatTouched] = useState(isEdit);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [variants, setVariants] = useState<VRow[]>(
    initial?.variants.map((v) => ({
      key: k(),
      id: v.id,
      label: v.label,
      kind: v.kind ?? "fresh",
      modelNumber: v.modelNumber,
      price: String(v.price),
      mrp: v.mrp ? String(v.mrp) : "",
      stock: String(v.stock),
    })) ?? [emptyVariant()],
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const catKey = useMemo(() => categoryKeyFromName(cats.find((c) => c.id === categoryId)?.name ?? ""), [categoryId, cats]);
  const [specs, setSpecs] = useState<SRow[]>(
    initial?.specs.length
      ? initial.specs.map((s) => ({ key: k(), ...s }))
      : specRows(SPEC_TEMPLATES[catKey ?? "other"]),
  );
  const [moq, setMoq] = useState(String(initial?.moq ?? 1));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [moreOpen, setMoreOpen] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: number; name: string } | null>(null);
  const [pending, start] = useTransition();
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [variantNote, setVariantNote] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // What we search the internet for: brand + model, without the RAM/storage part.
  const query = useMemo(() => {
    const base = parseVariant(name)?.rest ?? name;
    const b = brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ` : "";
    return `${b}${base}`.trim();
  }, [name, brand]);

  const cache = useRef(new Map<string, ImageResult[]>());
  async function runSearch(q: string) {
    const term = q.trim();
    if (term.length < 2) return;
    const hit = cache.current.get(term.toLowerCase());
    if (hit) {
      setSearch({ query: term, results: hit, loading: false, error: null, notConfigured: false });
      return;
    }
    setSearch((s) => ({ ...s, query: term, loading: true, error: null }));
    try {
      const r = await fetch(`/api/admin/image-search?q=${encodeURIComponent(term)}`);
      const d = (await r.json()) as { results?: ImageResult[]; error?: string };
      if (d.error === "not-configured") {
        setSearch({ ...EMPTY_SEARCH, query: term, notConfigured: true });
        return;
      }
      const results = d.results ?? [];
      cache.current.set(term.toLowerCase(), results);
      setSearch({
        query: term,
        results,
        loading: false,
        error: d.error ? t("Photo search failed — check the key in Settings") : results.length ? null : t("No photos found. Try a shorter name."),
        notConfigured: false,
      });
    } catch {
      setSearch((s) => ({ ...s, loading: false, error: t("Could not search photos (internet?)") }));
    }
  }

  // New model: search photos automatically ~1 second after typing stops.
  useEffect(() => {
    if (isEdit || images.length > 0 || query.length < 3 || search.notConfigured) return;
    const timer = setTimeout(() => void runSearch(query), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isEdit]);

  function onNameChange(v: string) {
    setName(v);
    setSaved(null);
    const b = brandTouched ? brand : detectBrand(v);
    if (!brandTouched) setBrand(b);
    if (!catTouched) {
      const id = findCategoryId(detectCategoryKey(v, b), cats);
      if (id !== categoryId) changeCategory(id, false);
    }
  }

  // "S24 Ultra 12/256" -> name "S24 Ultra" + variant "12GB / 256GB"
  function onNameBlur() {
    const pv = parseVariant(name);
    if (!pv || !pv.rest) return;
    setName(pv.rest);
    setVariants((rows) => {
      if (rows.some((r) => r.label.toLowerCase() === pv.label.toLowerCase())) return rows;
      const blank = rows.findIndex((r) => !r.label && !r.price);
      if (blank >= 0) return rows.map((r, i) => (i === blank ? { ...r, label: pv.label } : r));
      return [...rows, emptyVariant(pv.label)];
    });
    setVariantNote(t("Moved “{v}” to variants below", { v: pv.label }));
  }

  function changeCategory(id: number | null, touched = true) {
    setCategoryId(id);
    if (touched) setCatTouched(true);
    const key = categoryKeyFromName(cats.find((c) => c.id === id)?.name ?? "");
    // refresh the spec template only while Mama hasn't typed any spec yet
    setSpecs((rows) => (rows.some((r) => r.value.trim()) ? rows : specRows(SPEC_TEMPLATES[key ?? "other"])));
  }

  const setV = (key: string, patch: Partial<VRow>) =>
    setVariants((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addChip(label: string) {
    setVariants((rows) => {
      if (rows.some((r) => r.label === label)) return rows;
      const blank = rows.findIndex((r) => !r.label && !r.price);
      if (blank >= 0) return rows.map((r, i) => (i === blank ? { ...r, label } : r));
      return [...rows, emptyVariant(label)];
    });
  }

  function reset() {
    setName("");
    setBrand("");
    setBrandTouched(false);
    setCategoryId(null);
    setCatTouched(false);
    setImages([]);
    setVariants([emptyVariant()]);
    setDescription("");
    setSpecs(specRows(SPEC_TEMPLATES.other));
    setMoq("1");
    setIsActive(true);
    setSearch(EMPTY_SEARCH);
    setSaved(null);
    setError(null);
    setVariantNote(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => nameRef.current?.focus(), 300);
  }

  function submit() {
    setError(null);
    if (name.trim().length < 2) return setError(t("Type the model name first"));
    const vs = variants.filter((v) => v.label.trim() || v.price.trim() || v.stock.trim() || v.id);
    if (!vs.length) return setError(t("Enter the price"));
    if (vs.some((v) => toNum(v.price) <= 0)) return setError(t("Every variant needs a price"));
    const payload: ProductInput = {
      id: initial?.id,
      name: name.trim(),
      brand: brand.trim(),
      categoryId,
      description,
      specs: specs.map(({ label, value }) => ({ label, value })),
      images,
      moq: Math.max(1, toNum(moq)),
      isActive,
      variants: vs.map((v) => ({
        id: v.id,
        label: v.label,
        kind: v.kind,
        modelNumber: v.modelNumber,
        price: toNum(v.price),
        mrp: v.mrp ? toNum(v.mrp) : null,
        stock: toNum(v.stock),
      })),
    };
    start(async () => {
      const r = await saveProduct(payload);
      if (!r.ok) return setError(t(r.error));
      if (isEdit) {
        router.replace(`/admin/products/${r.id}?saved=${Date.now()}`, { scroll: true });
      } else {
        setSaved({ id: r.id, name: payload.name });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (saved && !isEdit) {
    return (
      <div className="card mx-auto max-w-lg space-y-4 p-8 text-center">
        <CircleCheck className="mx-auto size-14 text-emerald-500" />
        <div>
          <p className="text-xl font-extrabold text-brand-950">{t("Saved!")}</p>
          <p className="text-slate-600">
            <b>{saved.name}</b> {isActive ? t("is now live in the shop.") : t("is saved (hidden from shop).")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="btn btn-primary btn-lg">
            <Plus className="size-5" /> {t("Add another model")}
          </button>
          <Link href={`/p/${saved.id}`} className="btn btn-outline btn-lg">
            <Eye className="size-5" /> {t("View")}
          </Link>
        </div>
        <Link href={`/admin/products/${saved.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
          {t("Edit details")}
        </Link>
      </div>
    );
  }

  const chips = VARIANT_CHIPS[catKey ?? detectCategoryKey(name, brand) ?? "accessory"] ?? [];

  return (
    <div className="space-y-5 pb-24">
      {/* 1. Name */}
      <section className="card space-y-4 p-4 sm:p-5">
        <div>
          <label className="label text-base" htmlFor="pname">
            {t("Model name")}
          </label>
          <input
            id="pname"
            ref={nameRef}
            autoFocus={!isEdit}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameBlur}
            placeholder={t("e.g. Samsung S24 Ultra 12/256")}
            className="input py-3 text-lg font-semibold"
            autoComplete="off"
          />
          {variantNote && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Sparkles className="size-3.5" /> {variantNote}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pbrand">
              {t("Brand")} {!brandTouched && brand && <AutoTag />}
            </label>
            <input
              id="pbrand"
              list="brand-list"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setBrandTouched(true);
              }}
              className="input"
              placeholder={t("Brand")}
            />
            <datalist id="brand-list">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="pcat">
              {t("Category")} {!catTouched && categoryId && <AutoTag />}
            </label>
            <select
              id="pcat"
              value={categoryId ?? ""}
              onChange={(e) => changeCategory(Number(e.target.value) || null)}
              className="input"
            >
              <option value="">{t("— Choose —")}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 2. Photos */}
      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="font-bold text-brand-950">{t("Photos")}</h2>
        <PhotoPicker
          images={images}
          setImages={setImages}
          search={search}
          onSearch={runSearch}
          query={query}
          autoPick={!isEdit}
        />
      </section>

      {/* 3. Price & stock */}
      <section className="card space-y-3 p-4 sm:p-5">
        <div>
          <h2 className="font-bold text-brand-950">{t("Price & stock")}</h2>
          <p className="text-xs text-slate-500">{t("One row for each variant (RAM/storage, size…). Only price is required.")}</p>
        </div>
        {chips.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {chips.map((c) => {
              const used = variants.some((v) => v.label === c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => addChip(c)}
                  disabled={used}
                  className={`chip shrink-0 text-xs ${used ? "chip-active" : ""}`}
                >
                  {used ? <Check className="size-3" /> : <Plus className="size-3" />} {c}
                </button>
              );
            })}
          </div>
        )}
        <div className="space-y-3">
          {variants.map((v, i) => (
            <div key={v.key} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={v.label}
                  onChange={(e) => setV(v.key, { label: e.target.value })}
                  placeholder={variants.length > 1 ? t("Variant {n}, e.g. 12GB / 256GB", { n: i + 1 }) : t("Variant (optional), e.g. 12GB / 256GB")}
                  className="input flex-1 bg-white py-2 text-sm font-semibold"
                  aria-label={t("Variant name")}
                />
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={t("Remove variant")}
                  >
                    <Trash className="size-4" />
                  </button>
                )}
              </div>
              <div className="mb-2 inline-flex overflow-hidden rounded-xl ring-1 ring-slate-300" role="group" aria-label={t("Fresh or activated")}>
                {(["fresh", "activated"] as const).map((kd) => (
                  <button
                    key={kd}
                    type="button"
                    onClick={() => setV(v.key, { kind: kd })}
                    className={`px-3 py-1.5 text-xs font-extrabold uppercase ${
                      v.kind === kd ? (kd === "fresh" ? "bg-emerald-600 text-white" : "bg-gold-500 text-white") : "bg-white text-slate-500"
                    }`}
                  >
                    {kd === "fresh" ? t("Fresh") : t("Activated")}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MoneyInput label={t("Wholesale ₹")} value={v.price} onChange={(x) => setV(v.key, { price: x })} strong />
                <MoneyInput label={t("MRP ₹")} value={v.mrp} onChange={(x) => setV(v.key, { mrp: x })} />
                <MoneyInput label={t("Pieces")} value={v.stock} onChange={(x) => setV(v.key, { stock: x })} />
              </div>
              <input
                value={v.modelNumber}
                onChange={(e) => setV(v.key, { modelNumber: e.target.value })}
                placeholder={t("Model number (optional), e.g. SM-S928B")}
                className="input mt-2 bg-white py-2 text-sm"
                aria-label={t("Model number")}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setVariants((rows) => [...rows, emptyVariant()])} className="btn btn-outline btn-sm">
          <Plus className="size-4" /> {t("Add another variant")}
        </button>
      </section>

      {/* 4. Details */}
      <section className="card p-4 sm:p-5">
        <button type="button" onClick={() => setMoreOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
          <span>
            <span className="block font-bold text-brand-950">{t("Description & specs")}</span>
            <span className="block text-xs text-slate-500">{t("Optional — model number, colours, warranty, features")}</span>
          </span>
          <ChevronDown className={`size-5 text-slate-400 transition ${moreOpen ? "rotate-180" : ""}`} />
        </button>
        {moreOpen && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="pdesc">
                {t("Description")}
              </label>
              <textarea
                id="pdesc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                placeholder="Model no. SM-S928B · Colours: Titanium Black, Gray · 1 year brand warranty · Sealed box"
              />
            </div>
            <div>
              <p className="label">{t("Specifications")}</p>
              <div className="space-y-2">
                {specs.map((s) => (
                  <div key={s.key} className="flex gap-2">
                    <input
                      value={s.label}
                      onChange={(e) => setSpecs((rows) => rows.map((r) => (r.key === s.key ? { ...r, label: e.target.value } : r)))}
                      className="input w-2/5 py-2 text-sm text-slate-600"
                      placeholder={t("Name")}
                      aria-label={t("Spec name")}
                    />
                    <input
                      value={s.value}
                      onChange={(e) => setSpecs((rows) => rows.map((r) => (r.key === s.key ? { ...r, value: e.target.value } : r)))}
                      className="input flex-1 py-2 text-sm"
                      placeholder={t("Value")}
                      aria-label={`${s.label} value`}
                    />
                    <button
                      type="button"
                      onClick={() => setSpecs((rows) => rows.filter((r) => r.key !== s.key))}
                      className="rounded-lg p-2 text-slate-400 hover:text-rose-600"
                      aria-label={t("Remove spec")}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSpecs((rows) => [...rows, { key: k(), label: "", value: "" }])}
                className="btn btn-ghost btn-sm mt-2"
              >
                <Plus className="size-4" /> {t("Add spec")}
              </button>
              <p className="text-xs text-slate-500">{t("Empty rows are not shown in the shop.")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="pmoq">
                  {t("Minimum order (pcs)")}
                </label>
                <input id="pmoq" inputMode="numeric" value={moq} onChange={(e) => setMoq(e.target.value.replace(/\D/g, ""))} className="input num" />
                <p className="mt-1 text-xs text-slate-500">{t("Keep 1 so retailers can buy any quantity")}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 accent-brand-800" />
                <span className="text-sm font-semibold text-slate-800">{t("Show in shop")}</span>
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Save bar */}
      <div className="no-print fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom)+var(--badge,0px))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-[var(--badge,0px)] lg:left-[260px]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {error ? (
              <p className="font-semibold text-rose-600">{error}</p>
            ) : saved ? (
              <p className="flex items-center gap-1 font-semibold text-emerald-700">
                <Check className="size-4" /> {t("Saved")}
              </p>
            ) : (
              <p className="truncate text-slate-500">{name ? name : t("New model")}</p>
            )}
          </div>
          {initial && (
            <Link href={`/p/${initial.id}`} className="btn btn-outline">
              <Eye className="size-4" /> {t("View")}
            </Link>
          )}
          <button type="button" onClick={submit} disabled={pending} className="btn btn-primary btn-lg">
            {pending ? <LoaderCircle className="size-5 animate-spin" /> : <Check className="size-5" />}
            {isEdit ? t("Save changes") : t("Save model")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutoTag() {
  const t = useT();
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1 text-[10px] font-bold text-emerald-700 uppercase">
      <Sparkles className="size-2.5" /> {t("auto")}
    </span>
  );
}

function MoneyInput({ label, value, onChange, strong }: { label: string; value: string; onChange: (v: string) => void; strong?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className={`input num bg-white px-2.5 py-2 ${strong ? "font-bold text-brand-950" : ""}`}
        placeholder="0"
      />
    </label>
  );
}
