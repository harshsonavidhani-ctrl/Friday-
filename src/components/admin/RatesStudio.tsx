"use client";

import {
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  ClipboardPaste,
  Copy,
  FileText,
  History,
  LoaderCircle,
  MessageCircle,
  PackagePlus,
  RotateCcw,
  Save,
  Search,
  Trash,
  TriangleExclamationPoint,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useState } from "react";
import {
  addModelsFromMessage,
  applyRates,
  clearRateAliases,
  deleteRateMessage,
  linkRateLine,
  saveNewMessage,
  saveOldMessage,
  pickRateMessage,
} from "@/app/actions/rates";
import { useT } from "@/components/LangProvider";
import { ConfirmButton } from "@/components/ui";
import { formatDate, formatINR, waLink } from "@/lib/format";
import { buildIndex, matchRow } from "@/lib/import-match";
import {
  brandColor,
  kindKey,
  lineCatalogKey,
  lineIsNA,
  parseRates,
  productKey,
  renderRates,
  variantLabel,
  catalogKey,
  type PriceKind,
  type RateLine,
} from "@/lib/rate-message";

type Cat = { id: number; productId: number; name: string; brand: string; label: string; kind: "fresh" | "activated"; price: number; stock: number; isActive: boolean };
type Msg = { id: number; kind: "old" | "new"; isCurrent: boolean; applied: boolean; changes: number; createdAt: string; preview: string };
type Props = {
  catalog: Cat[];
  aliases: Record<string, number>;
  current: { id: number; text: string; createdAt: string } | null;
  history: Msg[];
  /** on the dashboard (the big tab already says "Update Rates") */
  embedded?: boolean;
};

const STEPS = [-500, -200, -100, 100, 200, 500];
const lk = (n: number, kind: PriceKind) => `${n}:${kind}`;

function readDraft(id: number | undefined) {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`la_rates_${id}`);
    return raw ? (JSON.parse(raw) as { edits: Record<string, number>; na: Record<string, boolean> }) : null;
  } catch {
    return null;
  }
}

export function RatesStudio({ catalog, aliases, current, history, embedded = false }: Props) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"old" | "new">(current ? "new" : "old");
  const [oldText, setOldText] = useState("");
  const [replacing, setReplacing] = useState(!current);
  const [links, setLinks] = useState<Record<string, number>>(aliases);
  const draft = useMemo(() => readDraft(current?.id), [current?.id]);
  const [edits, setEdits] = useState<Record<string, number>>(draft?.edits ?? {});
  const [naEdit, setNaEdit] = useState<Record<string, boolean>>(draft?.na ?? {});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [dealerOpen, setDealerOpen] = useState(false);
  const [dealerText, setDealerText] = useState("");
  const [note, setNote] = useState<{ ok?: string; error?: string } | null>(null);
  const [saved, setSaved] = useState<{ id: number; text: string } | null>(null);
  const [missingNA, setMissingNA] = useState<Record<number, boolean>>({});
  const [applied, setApplied] = useState<{ prices: number; na: number; text: string } | null>(null);
  const [onlyInStock, setOnlyInStock] = useState(true);

  // a different Old message arrived (saved / replaced / picked) → start fresh;
  // but keep the "Done!" screen until Mama taps "Start the next update"
  const [seenId, setSeenId] = useState(current?.id ?? 0);
  if ((current?.id ?? 0) !== seenId) {
    setSeenId(current?.id ?? 0);
    if (!applied) {
      const d = readDraft(current?.id);
      setEdits(d?.edits ?? {});
      setNaEdit(d?.na ?? {});
      setSaved(null);
      setReplacing(!current);
      setTab(current ? "new" : "old");
    }
  }

  const parsed = useMemo(() => (current ? parseRates(current.text) : null), [current]);
  // reading the clipboard needs a secure (https) page; otherwise Mama long-presses → Paste
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard && typeof window !== "undefined" && window.isSecureContext;
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const exact = useMemo(() => new Map(catalog.map((c) => [catalogKey(c.brand, c.name, c.label, c.kind), c.id])), [catalog]);
  const fuzzy = useMemo(
    () => ({
      fresh: buildIndex(catalog.filter((c) => c.kind === "fresh").map((c) => ({ ...c, modelNumber: "", mrp: null }))),
      activated: buildIndex(catalog.filter((c) => c.kind === "activated").map((c) => ({ ...c, modelNumber: "", mrp: null }))),
    }),
    [catalog],
  );

  /** which app model a line's price belongs to: remembered → same name → a guess */
  const resolve = useMemo(() => {
    const out = new Map<string, { id: number | null; guess: number | null }>();
    for (const l of parsed?.lines ?? []) {
      for (const p of l.prices) {
        const remembered = links[kindKey(l, p.kind)];
        let id = remembered && byId.has(remembered) ? remembered : null;
        if (!id) id = exact.get(lineCatalogKey(l, p.kind)) ?? null;
        let guess: number | null = null;
        if (!id) {
          const m = matchRow(fuzzy[p.kind], { text: `${l.name} ${variantLabel(l)}` });
          if (m && m.confidence !== "check") guess = m.ref.id;
        }
        out.set(lk(l.n, p.kind), { id, guess });
      }
    }
    return out;
  }, [parsed, links, byId, exact, fuzzy]);

  useEffect(() => {
    if (!current) return;
    try {
      localStorage.setItem(`la_rates_${current.id}`, JSON.stringify({ edits, na: naEdit }));
    } catch {
      /* private mode */
    }
  }, [edits, naEdit, current]);

  const priceOf = (l: RateLine, kind: PriceKind) => edits[lk(l.n, kind)] ?? l.prices.find((p) => p.kind === kind)?.value ?? 0;
  const naOf = (l: RateLine) => naEdit[l.n] ?? lineIsNA(l);
  const lineChanged = (l: RateLine) => l.prices.some((p) => priceOf(l, p.kind) !== p.value) || naOf(l) !== lineIsNA(l);

  const lines = parsed?.lines ?? [];
  const stats = useMemo(() => {
    let linked = 0;
    let missing = 0;
    let guesses = 0;
    for (const v of resolve.values()) {
      if (v.id) linked++;
      else if (v.guess) guesses++;
      else missing++;
    }
    return { linked, missing, guesses };
  }, [resolve]);
  const changedLines = lines.filter(lineChanged);
  const naLines = lines.filter(naOf);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = lines.filter((l) => {
    if (filter === "changed" && !lineChanged(l)) return false;
    if (filter === "na" && !naOf(l)) return false;
    if (filter.startsWith("brand:") && l.brand !== filter.slice(6)) return false;
    if (!words.length) return true;
    const hay = `${l.brand} ${l.name} ${variantLabel(l)} ${l.ram ?? ""}/${l.storage.replace(/gb|tb/i, "")} ${l.text}`.toLowerCase();
    return words.every((w) => hay.includes(w) || hay.replace(/\s+/g, "").includes(w));
  });

  // ── actions ──
  // busy only while the save itself runs (not while the page refreshes after it)
  const run = async (fn: () => Promise<void>) => {
    setNote(null);
    setBusy(true);
    try {
      await fn();
    } catch {
      setNote({ error: t("Something went wrong. Please try again.") });
    } finally {
      setBusy(false);
    }
  };

  const pasteInto = async (set: (s: string) => void) => {
    try {
      set(await navigator.clipboard.readText());
    } catch {
      setNote({ error: t("Long-press inside the box and choose Paste.") });
    }
  };

  const saveOld = () =>
    run(async () => {
      const r = await saveOldMessage(oldText);
      if (!r.ok) return setNote({ error: t(r.error) });
      setOldText("");
      setReplacing(false);
      setTab("new");
      router.refresh();
    });

  const addAll = () =>
    run(async () => {
      if (!parsed) return;
      const list = parsed.lines.flatMap((l) =>
        l.prices
          .filter((p) => !resolve.get(lk(l.n, p.kind))?.id && !resolve.get(lk(l.n, p.kind))?.guess)
          .map((p) => ({
            aliasKey: kindKey(l, p.kind),
            productKey: productKey(l.brandKey, l.name),
            brand: l.brand,
            name: l.name,
            label: variantLabel(l),
            kind: p.kind,
            price: p.value,
          })),
      );
      const r = await addModelsFromMessage(list, { onlyInStock });
      if (!r.ok) return setNote({ error: t(r.error) });
      setLinks((x) => ({ ...x, ...r.links }));
      setNote({ ok: t("{p} models ({v} prices) added to the app", { p: r.products, v: r.variants }) });
      router.refresh();
    });

  const acceptGuesses = () =>
    run(async () => {
      if (!parsed) return;
      const next: Record<string, number> = {};
      for (const l of parsed.lines)
        for (const p of l.prices) {
          const g = resolve.get(lk(l.n, p.kind));
          if (g && !g.id && g.guess) {
            await linkRateLine(kindKey(l, p.kind), g.guess);
            next[kindKey(l, p.kind)] = g.guess;
          }
        }
      setLinks((x) => ({ ...x, ...next }));
    });

  const applyDealer = () => {
    const d = parseRates(dealerText);
    if (!d.lines.length || !parsed) return setNote({ error: t("No rates found in that message") });
    const idx = buildIndex(
      parsed.lines.map((l) => ({ id: l.n, productId: 0, name: l.name, brand: l.brand, label: variantLabel(l), modelNumber: "", price: 0, mrp: null, stock: 0 })),
    );
    const byKey = new Map(parsed.lines.map((l) => [l.key, l]));
    let hit = 0;
    const missed: string[] = [];
    const next = { ...edits };
    const nextNa = { ...naEdit };
    for (const dl of d.lines) {
      const find = (text: string) => {
        const m = matchRow(idx, { text });
        return m && m.confidence !== "check" ? parsed.lines.find((l) => l.n === m.ref.id) : undefined;
      };
      // a dealer may put a line under the wrong brand heading → also try the model alone
      const target = byKey.get(dl.key) ?? find(`${dl.name} ${variantLabel(dl)}`) ?? find(`${dl.model} ${variantLabel(dl)}`);
      if (!target) {
        missed.push(dl.text.trim());
        continue;
      }
      for (const p of dl.prices) {
        if (target.prices.some((tp) => tp.kind === p.kind)) next[lk(target.n, p.kind)] = p.value;
      }
      if (lineIsNA(dl)) nextNa[target.n] = true;
      else if (naOf(target)) nextNa[target.n] = false;
      hit++;
    }
    setEdits(next);
    setNaEdit(nextNa);
    setDealerText("");
    setDealerOpen(false);
    setFilter("changed");
    setNote(
      missed.length
        ? { error: t("{n} rates changed. Not found: {list}", { n: hit, list: missed.slice(0, 5).join(" · ") }) }
        : { ok: t("{n} rates changed from the dealer message", { n: hit }) },
    );
  };

  const newText = () => (current && parsed ? renderRates(current.text, parsed.lines, priceOf, naOf) : "");

  const save = () =>
    run(async () => {
      const text = newText();
      const r = await saveNewMessage(text, changedLines.length);
      if (!r.ok) return setNote({ error: t(r.error) });
      setSaved({ id: r.id, text });
      setApplied(null);
    });

  // app models of the same brands that this message does not mention
  const linkedIds = new Set([...resolve.values()].map((v) => v.id).filter((x): x is number => !!x));
  const msgBrands = new Set((parsed?.brands ?? []).map((b) => b.toLowerCase()));
  const missingModels = catalog.filter((c) => c.isActive && c.stock > 0 && msgBrands.has(c.brand.toLowerCase()) && !linkedIds.has(c.id));

  const apply = () =>
    run(async () => {
      if (!saved || !parsed) return;
      const prices: { variantId: number; price: number }[] = [];
      const na: number[] = [];
      const back: number[] = [];
      for (const l of parsed.lines)
        for (const p of l.prices) {
          const id = resolve.get(lk(l.n, p.kind))?.id;
          if (!id) continue;
          prices.push({ variantId: id, price: priceOf(l, p.kind) });
          if (naOf(l)) na.push(id);
          else back.push(id);
        }
      for (const c of missingModels) if (missingNA[c.id]) na.push(c.id);
      const r = await applyRates({ messageId: saved.id, prices, notAvailable: na, available: back });
      if (!r.ok) return setNote({ error: t(r.error) });
      try {
        localStorage.removeItem(`la_rates_${current?.id}`);
      } catch {
        /* ignore */
      }
      setApplied({ prices: r.prices, na: r.notAvailable, text: saved.text });
    });

  // ───────────────────────── screens ─────────────────────────

  if (applied) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card space-y-3 bg-emerald-50 p-6 text-center ring-emerald-200">
          <Check className="mx-auto size-14 rounded-full bg-emerald-500 p-2 text-white" strokeWidth={3} />
          <p className="text-2xl font-extrabold text-emerald-900">{t("Done! Retailers see the new rates now.")}</p>
          <p className="text-lg font-semibold text-emerald-800">
            {t("{n} prices updated", { n: applied.prices })}
            {applied.na > 0 && ` · ${t("{n} marked not available", { n: applied.na })}`}
          </p>
        </div>
        <ShareMessage text={applied.text} />
        <button type="button" className="btn btn-primary btn-lg w-full text-lg" onClick={() => window.location.reload()}>
          <RotateCcw className="size-5" /> {t("Start the next update")}
        </button>
        <p className="text-center text-sm text-slate-500">{t("Tomorrow this message is your Old message automatically.")}</p>
      </div>
    );
  }

  const oldPanel = (
    <section className="space-y-3">
      <StepTitle n={1} title={t("Old message")} done={!!current && !replacing} />
      {!current || replacing ? (
        <div className="card space-y-3 p-4">
          <p className="text-base font-semibold text-slate-700">{t("Paste yesterday's rate message (the full list) and press Save.")}</p>
          <textarea
            value={oldText}
            onChange={(e) => setOldText(e.target.value)}
            rows={10}
            className="input font-mono text-[15px] leading-relaxed"
            placeholder={"TECNO MOBILE\n-------------\nG03/4/64 10250 f\nPop x /4/128 14800 f\n…"}
            aria-label={t("Old message")}
          />
          <div className="flex flex-wrap gap-2">
            {canPaste && (
              <button type="button" className="btn btn-outline btn-lg" onClick={() => pasteInto(setOldText)}>
                <ClipboardPaste className="size-5" /> {t("Paste")}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-lg flex-1 text-lg" disabled={busy || oldText.trim().length < 5} onClick={saveOld}>
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />} {t("Save old message")}
            </button>
            {current && (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => setReplacing(false)}>
                <X className="size-5" /> {t("Cancel")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-base font-bold text-slate-900">{t("Saved {date}", { date: formatDate(current.createdAt) })}</p>
              <p className="text-sm text-slate-600">
                {t("{n} models · {b} brands", { n: lines.length, b: parsed?.brands.length ?? 0 })}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setReplacing(true)}>
                <FileText className="size-4" /> {t("Replace")}
              </button>
              <ConfirmButton
                className="btn btn-outline btn-sm text-rose-600"
                confirmText={t("Tap again to delete")}
                onConfirm={async () => {
                  await deleteRateMessage(current.id);
                  router.refresh();
                }}
              >
                <Trash className="size-4" /> {t("Delete")}
              </ConfirmButton>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(parsed?.brands ?? []).map((b) => (
              <span key={b} className="rounded-lg px-2 py-1 text-xs font-bold text-white" style={{ background: brandColor(b) }}>
                {b} {lines.filter((l) => l.brand === b).length}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Big label={t("In the app")} value={stats.linked} tone="text-emerald-700" />
            <Big label={t("Please check")} value={stats.guesses} tone={stats.guesses ? "text-gold-700" : "text-slate-400"} />
            <Big label={t("Not in app yet")} value={stats.missing} tone={stats.missing ? "text-rose-700" : "text-slate-400"} />
          </div>
          {stats.missing > 0 && (
            <div className="space-y-2 rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-200">
              <p className="text-base font-bold text-brand-950">
                {t("{n} prices in this message are not in your app yet.", { n: stats.missing })}
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="size-5 accent-brand-800" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} />
                {t("Retailers see only “In stock” / “Not available” (no piece count)")}
              </label>
              <button type="button" className="btn btn-primary btn-lg w-full text-lg" disabled={busy} onClick={addAll}>
                {busy ? <LoaderCircle className="size-5 animate-spin" /> : <PackagePlus className="size-5" />} {t("Add all to the app")}
              </button>
            </div>
          )}
          {stats.guesses > 0 && (
            <div className="space-y-2 rounded-2xl bg-gold-50 p-3 ring-1 ring-gold-200">
              <p className="text-sm font-semibold text-gold-900">{t("{n} lines look like models already in the app.", { n: stats.guesses })}</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {lines.flatMap((l) =>
                  l.prices
                    .filter((p) => !resolve.get(lk(l.n, p.kind))?.id && resolve.get(lk(l.n, p.kind))?.guess)
                    .map((p) => {
                      const g = byId.get(resolve.get(lk(l.n, p.kind))!.guess!)!;
                      return (
                        <li key={lk(l.n, p.kind)} className="text-slate-700">
                          <b>{l.text.trim()}</b> → {g.name} {g.label} {g.kind === "activated" ? `(${t("Activated")})` : ""}
                        </li>
                      );
                    }),
                )}
              </ul>
              <button type="button" className="btn btn-gold w-full" disabled={busy} onClick={acceptGuesses}>
                <Check className="size-4" /> {t("Yes, these are the same")}
              </button>
            </div>
          )}
          {(parsed?.duplicates.length ?? 0) > 0 && (
            <p className="flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
              <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" />
              {t("Same model written twice — lines {list}. Check which price is right.", {
                list: parsed!.duplicates.map((d) => d.lines.join(" & ")).join(", "),
              })}
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-brand-700">{t("Show the message")}</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap">{current.text}</pre>
          </details>
        </div>
      )}

      <details className="card p-4">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
          <History className="size-4" /> {t("Saved messages")} ({history.length})
        </summary>
        <ul className="mt-3 divide-y divide-slate-100">
          {history.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <b>{m.kind === "old" ? t("Old") : t("New")}</b> · {formatDate(m.createdAt)}
                {m.applied && <span className="ml-1 text-emerald-700">· {t("sent to retailers")}</span>}
                {m.isCurrent && <span className="ml-1 font-bold text-brand-700">· {t("in use")}</span>}
              </span>
              <span className="flex gap-1">
                {!m.isCurrent && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => run(async () => (await pickRateMessage(m.id), router.refresh()))}>
                    {t("Use")}
                  </button>
                )}
                <ConfirmButton
                  className="btn btn-ghost btn-sm text-rose-600"
                  confirmText={t("Delete?")}
                  onConfirm={async () => {
                    await deleteRateMessage(m.id);
                    router.refresh();
                  }}
                >
                  <Trash className="size-4" />
                </ConfirmButton>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs text-slate-500">
            {t("The app remembers which line is which model ({n} remembered).", { n: Object.keys(links).length })}
          </p>
          <ConfirmButton
            className="btn btn-outline btn-sm text-rose-600"
            confirmText={t("Tap again — forget all")}
            onConfirm={async () => {
              await clearRateAliases();
              setLinks({});
              router.refresh();
            }}
          >
            <Trash className="size-4" /> {t("Forget remembered names")}
          </ConfirmButton>
        </div>
      </details>
    </section>
  );

  const newPanel = current && parsed && (
    <section className="space-y-3">
      <StepTitle n={2} title={t("New message — change the rates")} done={changedLines.length > 0} />
      <div className="sticky top-[60px] z-20 space-y-2 rounded-2xl bg-slate-50/95 py-1 backdrop-blur lg:top-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder={t("Search model… e.g. T5x 8/128")}
            className="w-full rounded-2xl border-2 border-brand-200 bg-white py-4 pr-4 pl-13 text-lg font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
            aria-label={t("Search model")}
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip on={filter === "all"} onClick={() => setFilter("all")}>
            {t("All")} {lines.length}
          </Chip>
          <Chip on={filter === "changed"} onClick={() => setFilter("changed")} tone="#b44b09">
            {t("Changed")} {changedLines.length}
          </Chip>
          <Chip on={filter === "na"} onClick={() => setFilter("na")} tone="#be123c">
            {t("Not available")} {naLines.length}
          </Chip>
          {parsed.brands.map((b) => (
            <Chip key={b} on={filter === `brand:${b}`} onClick={() => setFilter(filter === `brand:${b}` ? "all" : `brand:${b}`)} tone={brandColor(b)}>
              {b}
            </Chip>
          ))}
        </div>
      </div>

      <div className="card space-y-2 p-3">
        {!dealerOpen ? (
          <button type="button" className="btn btn-outline w-full py-3 text-left whitespace-normal" onClick={() => setDealerOpen(true)}>
            <ClipboardPaste className="size-5 shrink-0" /> {t("Paste a dealer's rate update (changes rates automatically)")}
          </button>
        ) : (
          <>
            <textarea
              value={dealerText}
              onChange={(e) => setDealerText(e.target.value)}
              rows={5}
              className="input font-mono text-[15px]"
              placeholder={t("e.g. Pop x /4/128 15000 f")}
              aria-label={t("Dealer message")}
            />
            <div className="flex flex-wrap gap-2">
              {canPaste && (
                <button type="button" className="btn btn-outline" onClick={() => pasteInto(setDealerText)}>
                  <ClipboardPaste className="size-4" /> {t("Paste")}
                </button>
              )}
              <button type="button" className="btn btn-primary flex-1" disabled={!dealerText.trim()} onClick={applyDealer}>
                <Check className="size-4" /> {t("Change these rates")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDealerOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        {parsed.brands
          .map((b) => ({ b, ls: shown.filter((l) => l.brand === b) }))
          .filter((g) => g.ls.length)
          .map((g) => (
            <div key={g.b} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: brandColor(g.b) }}>
                <span className="text-lg font-extrabold tracking-wide uppercase">{g.b}</span>
                <span className="text-sm font-bold opacity-90">{g.ls.length}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.ls.map((l) => (
                  <LineCard
                    key={l.n}
                    line={l}
                    color={brandColor(g.b)}
                    values={l.prices.map((p) => priceOf(l, p.kind))}
                    na={naOf(l)}
                    inApp={l.prices.every((p) => !!resolve.get(lk(l.n, p.kind))?.id)}
                    onPrice={(kind, v) => setEdits((e) => ({ ...e, [lk(l.n, kind)]: v }))}
                    onNA={(v) => setNaEdit((x) => ({ ...x, [l.n]: v }))}
                  />
                ))}
              </ul>
            </div>
          ))}
        {shown.length === 0 && <p className="card p-8 text-center text-lg text-slate-500">{t("No model matches “{q}”.", { q })}</p>}
      </div>
    </section>
  );

  return (
    <div className="space-y-4 pb-32">
      <div>
        {!embedded && <h1 className="text-3xl font-extrabold tracking-tight text-brand-950">{t("Update Rates")}</h1>}
        <p className="text-base font-semibold text-slate-600">{t("① Old message → ② Change rates → ③ Save → ④ Update retailers")}</p>
      </div>

      {current && (
        <div className="grid grid-cols-2 gap-2 lg:hidden">
          <TabButton on={tab === "old"} onClick={() => setTab("old")} n={1} label={t("Old message")} />
          <TabButton on={tab === "new"} onClick={() => setTab("new")} n={2} label={t("New message")} badge={changedLines.length} />
        </div>
      )}

      {note && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-base font-semibold ring-1 ${note.error ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}
        >
          {note.error ?? note.ok}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className={current && tab !== "old" ? "hidden lg:block" : ""}>{oldPanel}</div>
        {current && <div className={tab !== "new" ? "hidden lg:block" : ""}>{newPanel}</div>}
      </div>

      {/* save bar */}
      {current && parsed && !saved && (!embedded || changedLines.length > 0) && (
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom)+var(--badge,0px))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-[var(--badge,0px)] lg:left-[260px]">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <p className="min-w-0 flex-1 text-base text-slate-700">
              <b className="text-xl text-gold-700">{changedLines.length}</b> {t("rates changed")}
            </p>
            {changedLines.length > 0 && (
              <ConfirmButton
                className="btn btn-ghost"
                confirmText={t("Undo all?")}
                confirmClassName="btn bg-gold-400 text-brand-950"
                onConfirm={() => {
                  setEdits({});
                  setNaEdit({});
                }}
              >
                <RotateCcw className="size-5" />
              </ConfirmButton>
            )}
            <button type="button" className="btn btn-success btn-lg px-6 text-lg" disabled={busy || changedLines.length === 0} onClick={save}>
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />} {t("Save")}
            </button>
          </div>
        </div>
      )}

      {/* step 3–4: saved → update retailers? */}
      {saved && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal>
          <div className="max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom)+var(--badge,0px))] sm:rounded-3xl">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="size-6" strokeWidth={3} />
              </span>
              <div>
                <p className="text-xl font-extrabold text-slate-900">{t("Saved ✓")}</p>
                <p className="text-sm text-slate-600">{t("{n} rates changed", { n: changedLines.length })}</p>
              </div>
            </div>

            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-2xl ring-1 ring-slate-200">
              {changedLines.map((l) => (
                <li key={l.n} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 text-sm font-semibold text-slate-900">
                    {l.name} <span className="font-normal text-slate-500">{variantLabel(l)}</span>
                  </span>
                  <span className="num flex flex-wrap gap-2 text-sm">
                    {naOf(l) ? (
                      <b className="text-rose-700">{t("Not available")}</b>
                    ) : (
                      l.prices.map((p) => <Diff key={p.kind} from={p.value} to={priceOf(l, p.kind)} kind={p.kind} />)
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {lines.some((l) => lineChanged(l) && l.prices.some((p) => !resolve.get(lk(l.n, p.kind))?.id)) && (
              <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
                {t("Some changed models are not in the app yet, so retailers will not see them. Add them in “Old message” first.")}
              </p>
            )}

            {missingModels.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-base font-bold text-slate-900">{t("{n} models in the app are not in this message", { n: missingModels.length })}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline btn-sm flex-1" onClick={() => setMissingNA({})}>
                    {t("All: keep old price")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm flex-1 text-rose-700"
                    onClick={() => setMissingNA(Object.fromEntries(missingModels.map((m) => [m.id, true])))}
                  >
                    {t("All: not available")}
                  </button>
                </div>
                <ul className="max-h-44 space-y-1 overflow-y-auto">
                  {missingModels.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {m.name} <span className="text-slate-500">{m.label}</span>
                      </span>
                      <span className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-300">
                        <button
                          type="button"
                          className={`px-2 py-1 text-xs font-bold ${!missingNA[m.id] ? "bg-brand-900 text-white" : "bg-white text-slate-600"}`}
                          onClick={() => setMissingNA((x) => ({ ...x, [m.id]: false }))}
                        >
                          {t("Keep old price")}
                        </button>
                        <button
                          type="button"
                          className={`px-2 py-1 text-xs font-bold ${missingNA[m.id] ? "bg-rose-600 text-white" : "bg-white text-slate-600"}`}
                          onClick={() => setMissingNA((x) => ({ ...x, [m.id]: true }))}
                        >
                          {t("Not available")}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2 rounded-2xl bg-brand-950 p-4 text-white">
              <p className="text-xl font-extrabold">{t("Update retailers' prices now?")}</p>
              <p className="text-sm text-white/75">{t("Retailers will see the new rates in their app straight away.")}</p>
              <button type="button" className="btn btn-gold btn-lg w-full text-lg" disabled={busy} onClick={apply}>
                {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Check className="size-5" />} {t("Yes, update now")}
              </button>
              <button type="button" className="btn btn-lg w-full bg-white/10 text-white" disabled={busy} onClick={() => setSaved(null)}>
                {t("Not now")}
              </button>
            </div>
            {note?.error && <p className="text-sm font-semibold text-rose-600">{note.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const LineCard = memo(function LineCard({
  line,
  color,
  values,
  na,
  inApp,
  onPrice,
  onNA,
}: {
  line: RateLine;
  color: string;
  values: number[];
  na: boolean;
  inApp: boolean;
  onPrice: (kind: PriceKind, v: number) => void;
  onNA: (v: boolean) => void;
}) {
  const t = useT();
  const label = variantLabel(line);
  return (
    <li className={`space-y-2 border-l-[6px] px-3 py-3 ${na ? "bg-rose-50/60" : ""}`} style={{ borderLeftColor: color }}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg leading-tight font-extrabold text-slate-900">{line.name}</p>
        {label && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700">{label}</span>}
        {!inApp && <span className="badge bg-rose-50 text-rose-700 ring-rose-200">{t("Not in app")}</span>}
      </div>
      {line.prices.map((p, i) => (
        <PriceRow key={`${p.kind}-${values[i]}`} kind={p.kind} old={p.value} value={values[i]} disabled={na} onChange={(v) => onPrice(p.kind, v)} />
      ))}
      <button
        type="button"
        onClick={() => onNA(!na)}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ring-1 ${na ? "bg-rose-600 text-white ring-rose-600" : "bg-white text-slate-600 ring-slate-300"}`}
      >
        <Ban className="size-4" /> {na ? t("Not available — tap to make available") : t("Mark not available")}
      </button>
    </li>
  );
});

function PriceRow({ kind, old, value, disabled, onChange }: { kind: PriceKind; old: number; value: number; disabled: boolean; onChange: (v: number) => void }) {
  const t = useT();
  const [raw, setRaw] = useState(String(value));
  const diff = value - old;
  const commit = () => {
    const n = Number(raw.replace(/\D/g, ""));
    if (n > 0 && n !== value) onChange(n);
    else setRaw(String(value));
  };
  return (
    <div className={`space-y-2 rounded-2xl p-2.5 ${kind === "fresh" ? "bg-emerald-50/70 ring-1 ring-emerald-200" : "bg-gold-50 ring-1 ring-gold-200"} ${disabled ? "opacity-40" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-extrabold tracking-wide text-white ${kind === "fresh" ? "bg-emerald-600" : "bg-gold-600"}`}>
          {kind === "fresh" ? t("FRESH") : t("ACTIVATED")}
        </span>
        <span className="num text-sm text-slate-500">
          {t("Old")} {formatINR(old)}
        </span>
        <label className="relative ml-auto">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
          <input
            value={raw}
            disabled={disabled}
            inputMode="numeric"
            onChange={(e) => setRaw(e.target.value.replace(/\D/g, ""))}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className={`num w-36 rounded-xl border-2 bg-white py-2 pr-3 pl-8 text-right text-2xl font-extrabold focus:outline-none ${
              diff > 0 ? "border-emerald-500 text-emerald-700" : diff < 0 ? "border-rose-400 text-rose-700" : "border-slate-300 text-slate-900"
            }`}
            aria-label={`${kind === "fresh" ? t("Fresh") : t("Activated")} ${t("price")}`}
          />
        </label>
      </div>
      {diff !== 0 && (
        <p className={`num flex items-center gap-1 text-base font-extrabold ${diff > 0 ? "text-emerald-700" : "text-rose-700"}`}>
          {diff > 0 ? <ArrowUp className="size-5" /> : <ArrowDown className="size-5" />}
          {diff > 0 ? "+" : "−"}
          {formatINR(Math.abs(diff))}
          <button type="button" className="ml-2 text-xs font-semibold text-slate-500 underline" onClick={() => onChange(old)}>
            {t("undo")}
          </button>
        </p>
      )}
      <div className="grid grid-cols-6 gap-1.5">
        {STEPS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(Math.max(1, value + s))}
            className={`num h-11 rounded-xl text-[15px] font-extrabold active:scale-95 ${
              s > 0 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
            aria-label={`${s > 0 ? "+" : "−"}${Math.abs(s)}`}
          >
            {s > 0 ? "+" : "−"}
            {Math.abs(s)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Diff({ from, to, kind }: { from: number; to: number; kind: PriceKind }) {
  const t = useT();
  if (from === to) return null;
  const up = to > from;
  return (
    <span className={`font-bold ${up ? "text-emerald-700" : "text-rose-700"}`}>
      {kind === "activated" ? `${t("Act.")} ` : ""}
      <s className="font-normal text-slate-400">{formatINR(from)}</s> → {formatINR(to)} {up ? "▲" : "▼"}
    </span>
  );
}

function ShareMessage({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="card space-y-3 p-4">
      <p className="text-base font-bold text-slate-900">{t("New rate message (ready to send)")}</p>
      <pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap">{text}</pre>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-outline btn-lg"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              /* long-press the text instead */
            }
          }}
        >
          <Copy className="size-5" /> {copied ? t("Copied") : t("Copy")}
        </button>
        <a href={waLink("", text)} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-lg">
          <MessageCircle className="size-5" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

function StepTitle({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-extrabold text-brand-950">
      <span className={`flex size-9 items-center justify-center rounded-full text-lg ${done ? "bg-emerald-500 text-white" : "bg-gold-400 text-brand-950"}`}>
        {done ? <Check className="size-5" strokeWidth={3} /> : n}
      </span>
      {title}
    </h2>
  );
}

function TabButton({ on, onClick, n, label, badge }: { on: boolean; onClick: () => void; n: number; label: string; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center gap-2 rounded-2xl px-3 py-3.5 text-base font-extrabold ring-2 ${
        on ? "bg-brand-900 text-white ring-brand-900" : "bg-white text-brand-900 ring-brand-200"
      }`}
    >
      <span className={`flex size-7 items-center justify-center rounded-full text-sm ${on ? "bg-gold-400 text-brand-950" : "bg-brand-100"}`}>{n}</span>
      {label}
      {!!badge && <span className="num absolute -top-2 -right-1 rounded-full bg-gold-500 px-2 text-xs font-bold text-white">{badge}</span>}
    </button>
  );
}

function Chip({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-3.5 py-2 text-sm font-bold whitespace-nowrap ring-2"
      style={on ? { background: tone ?? "#1e2b80", color: "#fff", boxShadow: "none", borderColor: tone } : { background: "#fff", color: tone ?? "#334155" }}
    >
      {children}
    </button>
  );
}

function Big({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
      <p className={`num text-2xl font-extrabold ${tone}`}>{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}
