// Reads Mama's WhatsApp rate messages, e.g.
//
//   TECNO MOBILE
//   ---------------
//   Pop x /4/128 14800 f
//   C85x-4/64  12625  a 12990 f        ← activated + fresh on one line
//   Nova 2 ultra /8/128 21500 with
//   Ear buds                           ← continues the line above
//
// and writes the same message back with new prices. Pure, client-safe.

export type PriceKind = "fresh" | "activated";
export type RatePrice = { kind: PriceKind; value: number; start: number; end: number };

export type RateLine = {
  n: number; // line number in the message (1-based)
  text: string; // the line exactly as written (prices are in here)
  more: string; // continuation lines joined ("Ear buds")
  brand: string; // "Tecno"
  brandKey: string;
  model: string; // "Pop X"
  name: string; // product name: "Tecno Pop X"
  ram: number | null;
  storage: string; // "128GB" | "1TB" | ""
  net: "" | "4G" | "5G";
  extras: string[]; // part of the variant: "With Neckband", "Without Sim"
  notes: string[]; // just notes: "old", "mix", "new model"
  prices: RatePrice[];
  key: string; // identity without fresh/activated
};

export type ParsedRates = {
  lines: RateLine[];
  brands: string[];
  skipped: { n: number; text: string }[];
  duplicates: { key: string; kind: PriceKind; lines: number[] }[];
};

type BrandInfo = { brand: string; prefix: string; aliases: string[] };

// section heading word → brand shown in the shop + how product names start
const BRANDS: Record<string, BrandInfo> = {
  tecno: { brand: "Tecno", prefix: "Tecno", aliases: ["tecno"] },
  itel: { brand: "itel", prefix: "itel", aliases: ["itel"] },
  ai: { brand: "AI+", prefix: "AI+", aliases: ["ai", "ai+"] },
  nokia: { brand: "Nokia", prefix: "Nokia", aliases: ["nokia"] },
  hmd: { brand: "HMD", prefix: "HMD", aliases: ["hmd"] },
  lava: { brand: "Lava", prefix: "Lava", aliases: ["lava"] },
  poco: { brand: "POCO", prefix: "POCO", aliases: ["poco"] },
  infinix: { brand: "Infinix", prefix: "Infinix", aliases: ["infinix"] },
  oppo: { brand: "OPPO", prefix: "OPPO", aliases: ["oppo"] },
  xiaomi: { brand: "Redmi", prefix: "Redmi", aliases: ["redmi"] },
  redmi: { brand: "Redmi", prefix: "Redmi", aliases: ["redmi"] },
  mi: { brand: "Xiaomi", prefix: "Xiaomi", aliases: ["mi", "xiaomi"] },
  realme: { brand: "realme", prefix: "realme", aliases: ["realme"] },
  narzo: { brand: "realme", prefix: "Narzo", aliases: ["narzo"] },
  nothing: { brand: "Nothing", prefix: "Nothing", aliases: ["nothing"] },
  notting: { brand: "Nothing", prefix: "Nothing", aliases: ["nothing", "notting"] },
  cmf: { brand: "CMF", prefix: "CMF", aliases: ["cmf"] },
  vivo: { brand: "vivo", prefix: "vivo", aliases: ["vivo"] },
  samsung: { brand: "Samsung", prefix: "Samsung", aliases: ["samsung", "galaxy"] },
  iqoo: { brand: "iQOO", prefix: "iQOO", aliases: ["iqoo"] },
  moto: { brand: "Motorola", prefix: "Moto", aliases: ["moto", "motorola"] },
  motorola: { brand: "Motorola", prefix: "Moto", aliases: ["moto", "motorola"] },
  oneplus: { brand: "OnePlus", prefix: "OnePlus", aliases: ["oneplus"] },
  google: { brand: "Google", prefix: "Google Pixel", aliases: ["google", "pixel"] },
  pixel: { brand: "Google", prefix: "Google Pixel", aliases: ["google", "pixel"] },
  mivi: { brand: "Mivi", prefix: "Mivi", aliases: ["mivi"] },
  apple: { brand: "Apple", prefix: "Apple", aliases: ["apple"] },
  iphone: { brand: "Apple", prefix: "Apple iPhone", aliases: ["iphone"] },
  honor: { brand: "Honor", prefix: "Honor", aliases: ["honor"] },
  jio: { brand: "Jio", prefix: "Jio", aliases: ["jio"] },
  micromax: { brand: "Micromax", prefix: "Micromax", aliases: ["micromax"] },
  boat: { brand: "boAt", prefix: "boAt", aliases: ["boat"] },
};

// Mama's usual spellings → proper words (also used for matching)
const TYPOS: Record<string, string> = {
  powar: "power",
  fuision: "fusion",
  fusoin: "fusion",
  nona: "nova",
  ulta: "ultra",
  ultr: "ultra",
  nio: "neo",
  notting: "nothing",
  paid: "pad",
  liet: "lite",
  pluss: "plus",
};

const UPPER = new Set(["hmd", "poco", "oppo", "hd", "se", "fe", "ss", "ds", "ce", "evo", "5g", "4g", "tb", "ai+", "cmf"]);
const RAMS = new Set([1, 2, 3, 4, 6, 8, 10, 12, 16, 18, 24]);
const FRESH = new Set(["f", "fresh", "new"]);
const ACTIVE = new Set(["a", "act", "activated", "active", "actv"]);
const IDENTITY_WORDS = new Set(["sim", "wifi", "wi", "fi", "calling", "tab", "tb", "dual", "single", "esim"]);
const CONTINUES = /^(with|without|ear|earbuds|buds|neckband|charger|sim|box)\b/i;
const SERIES = /^(smart|spark|pova|nova|note|hot|reno|tab|camon|zeno|narzo|agni|blaze)(\d+)/i;

const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");

function fixWord(w: string) {
  const low = w.toLowerCase();
  return TYPOS[low] ?? w;
}

/** "SMART20" → "Smart 20", "T4lite" → "T4 Lite", "A100 c" → "A100c" */
function cleanModel(raw: string): string {
  let words = raw
    .replace(/[|]/g, " ")
    .replace(/(\d)(lite|pro|plus|max|ultra|neo|nio|power|powar|prime|turbo|fusion|fuision)\b/gi, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => {
      const m = w.match(SERIES);
      return m && m[0].length === w.length ? [m[1], m[2]] : [w];
    })
    .map(fixWord);
  // "50 s" → "50s", "A100 c" → "A100c", "pro +" → "pro+"
  const out: string[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    if (prev && ((/\d$/.test(prev) && /^[a-z]$/i.test(w)) || w === "+")) out[out.length - 1] = prev + w;
    else out.push(w);
  }
  words = out;
  return words
    .map((w) => {
      const low = w.toLowerCase();
      if (UPPER.has(low)) return low === "ai+" ? "AI+" : w.toUpperCase();
      if (/\d/.test(w)) return w.charAt(0).toUpperCase() + w.slice(1);
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ")
    .trim();
}

function titleExtra(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.toLowerCase() === "wi" ? "Wi" : w.toLowerCase() === "fi" ? "Fi" : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bWi Fi\b/, "Wi-Fi");
}

function brandOf(word: string): BrandInfo | null {
  const w = word.toLowerCase().replace(/[^a-z+]/g, "");
  return BRANDS[w] ?? null;
}

/** A section heading: "TECNO MOBILE", "XIAOMI(REDMI)", "NARZO (realme)", "Moto", "Notting" */
function headingBrand(line: string): BrandInfo | null {
  const words = line
    .replace(/[()*_~:]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.length > 5) return null;
  for (const w of words) {
    const b = brandOf(w);
    if (b) return b;
  }
  return null;
}

// RAM / storage: "4/64", "8+128", "12.256", "4//64", "4/ 128", "6/1285g", "12/1TB"
const VARIANT_RE = /(\d{1,2})\s*(?:\/{1,2}|\+|\.)\s*(1024|512|256|128|64|32|16|1|2)(?:\s*(gb|tb))?(?=[45]g\b|[^\d]|$)/gi;
// prices: 3–6 digits (or 1,25,000), may be glued to f / a, never right after "/"
const PRICE_RE = /(?<![\d/.,])(\d{1,3}(?:,\d{2,3})+|\d{3,6})(?![\d,]|\.\d)(f|a)?(?![a-z\d])/gi;

type Found = { value: number; start: number; end: number; glued: PriceKind | null };

function findVariant(s: string) {
  let best: { ram: number | null; storage: string; start: number; end: number } | null = null;
  for (const m of s.matchAll(VARIANT_RE)) {
    const ram = Number(m[1]);
    const st = Number(m[2]);
    let end = m.index! + m[0].length;
    let unit = (m[3] ?? (st <= 2 ? "tb" : "gb")).toUpperCase();
    // "6/128 tb" — here "tb" is a word (tab), not terabytes
    if (unit === "TB" && st > 2) {
      unit = "GB";
      end = m.index! + m[0].search(/\s*tb$/i);
    }
    if (unit === "GB" && st < 16) continue;
    const storage = `${st}${unit}`;
    if (RAMS.has(ram)) best = { ram, storage, start: m.index!, end };
    // "Pixel 11/256" → model "Pixel 11", 256GB
    else best = { ram: null, storage, start: m.index! + m[1].length, end };
  }
  return best;
}

function findPrices(s: string, from: number): Found[] {
  const out: Found[] = [];
  PRICE_RE.lastIndex = 0;
  for (const m of s.matchAll(PRICE_RE)) {
    if (m.index! < from) continue;
    const value = Number(m[1].replace(/,/g, ""));
    if (value < 100 || value > 999999) continue;
    const g = m[2]?.toLowerCase();
    out.push({ value, start: m.index!, end: m.index! + m[1].length, glued: g === "f" ? "fresh" : g === "a" ? "activated" : null });
  }
  return out;
}

export function parseRates(text: string): ParsedRates {
  const rows = text.replace(/\r/g, "").split("\n");
  const lines: RateLine[] = [];
  const skipped: { n: number; text: string }[] = [];
  const brands: string[] = [];
  let section: BrandInfo | null = null;

  rows.forEach((row, i) => {
    const n = i + 1;
    const t = row.replace(/ /g, " ");
    const trimmed = t.trim().replace(/^[*_~]+|[*_~]+$/g, "");
    if (!trimmed || /^[-=_.~*•\s]+$/.test(trimmed)) return;

    const variant = findVariant(t);
    let prices = findPrices(t, variant ? variant.end : 0);
    if (!variant && prices.length > 1) {
      // "Ss 105 ss without Charger 945" — only the last number(s) are prices
      const keep: Found[] = [prices[prices.length - 1]];
      for (let k = prices.length - 2; k >= 0; k--) {
        const gap = t.slice(prices[k].end, keep[0].start).trim().toLowerCase();
        if (gap.split(/\s+/).every((w) => !w || FRESH.has(w) || ACTIVE.has(w))) keep.unshift(prices[k]);
        else break;
      }
      prices = keep;
    }

    if (!prices.length) {
      const hb = headingBrand(trimmed);
      const next = rows.slice(i + 1).find((r) => r.trim());
      if (hb && (trimmed.length < 40 || /^[-=_]{3,}/.test(next?.trim() ?? ""))) {
        section = hb;
        if (!brands.includes(hb.brand)) brands.push(hb.brand);
        return;
      }
      const last = lines[lines.length - 1];
      const endsWith = !!last && /\bwith\s*$/i.test(last.text);
      if (last && last.n >= n - 2 && trimmed.length < 40 && (endsWith || CONTINUES.test(trimmed))) {
        // "Ear buds" / "Without ear buds" belongs to the line above
        last.more = `${last.more} ${trimmed}`.trim();
        last.extras = [...last.extras.filter((e) => e.toLowerCase() !== "with"), titleExtra(`${endsWith ? "with " : ""}${trimmed}`)];
        last.key = makeKey(last);
        return;
      }
      if (/^[-=_]{3,}/.test(next?.trim() ?? "") && trimmed.length < 40) {
        // a heading we don't know yet, e.g. "HONOR PHONES"
        const b = cleanModel(trimmed.replace(/\b(mobiles?|phones?)\b/gi, "").trim());
        section = { brand: b, prefix: b, aliases: [b.toLowerCase()] };
        if (!brands.includes(b)) brands.push(b);
        return;
      }
      skipped.push({ n, text: trimmed });
      return;
    }

    // ── model text: everything before the variant (or before the first price)
    const modelEnd = variant ? variant.start : prices[0].start;
    const modelRaw = t
      .slice(0, modelEnd)
      .replace(/[-–/]+\s*$/, "")
      .replace(/^[-–•*\s]+/, "")
      .trim();

    // ── after the variant: network, extras, markers, notes
    const tailStart = variant ? variant.end : modelEnd;
    const tail = t.slice(tailStart);
    let net: RateLine["net"] = "";
    const extras: string[] = [];
    const notes: string[] = [];
    const kinds: (PriceKind | null)[] = prices.map((p) => p.glued);
    let pending: PriceKind | null = null;
    let phrase: string[] = []; // "with neckband", "without sim"
    let words: string[] = []; // "wi fi", "tb", "calling tab"
    const flush = () => {
      if (phrase.length) extras.push(titleExtra(phrase.join(" ")));
      if (words.length) extras.push(titleExtra(words.join(" ")));
      phrase = [];
      words = [];
    };
    let cursor = 0; // prices passed so far
    const tokens = [...tail.matchAll(/\S+/g)].map((m) => ({ w: m[0], start: tailStart + m.index!, end: tailStart + m.index! + m[0].length }));
    for (const tok of tokens) {
      const pi = prices.findIndex((p) => p.start >= tok.start && p.start < tok.end);
      if (pi >= 0) {
        flush();
        if (!kinds[pi] && pending) kinds[pi] = pending;
        pending = null;
        cursor = pi + 1;
        continue;
      }
      const w = tok.w.toLowerCase().replace(/[(),.;:!]+/g, "");
      if (!w) continue;
      if (w === "5g" || w === "4g") {
        net = w.toUpperCase() as "4G" | "5G";
        continue;
      }
      const isKind = FRESH.has(w) ? "fresh" : ACTIVE.has(w) ? "activated" : null;
      if (isKind && !phrase.length) {
        // a marker right after a price belongs to it, otherwise to the next price
        if (cursor > 0 && !kinds[cursor - 1]) kinds[cursor - 1] = isKind;
        else pending = isKind;
        continue;
      }
      if (w === "with" || w === "without") {
        flush();
        phrase = [w];
        continue;
      }
      if (phrase.length) {
        phrase.push(w);
        continue;
      }
      if (cursor === 0 || IDENTITY_WORDS.has(w)) words.push(w);
      else notes.push(w);
    }
    flush();

    // ── brand: the line's first word wins ("Lava v1", "Hmd vibe", "Mivi"), else the section
    const firstWord = modelRaw.split(/\s+/)[0] ?? "";
    const own = brandOf(firstWord);
    const info: BrandInfo = own ?? section ?? { brand: "", prefix: "", aliases: [] };
    if (info.brand && !brands.includes(info.brand)) brands.push(info.brand);
    let model = cleanModel(modelRaw);
    const mWords = model.split(" ");
    const startsWithAlias = own || (section && section.aliases.includes(mWords[0]?.toLowerCase().replace(/[^a-z+]/g, "")));
    if (startsWithAlias) model = mWords.slice(1).join(" ").trim();
    // "Pixel 11" under Google → prefix already says Pixel
    const prefixLast = info.prefix.split(" ").pop()?.toLowerCase();
    if (prefixLast && model.split(" ")[0]?.toLowerCase() === prefixLast) model = model.split(" ").slice(1).join(" ");
    const name = [info.prefix, model].filter(Boolean).join(" ").trim() || modelRaw;

    // ── prices: default fresh; two of the same kind → second is activated
    const seen = new Set<PriceKind>();
    const ps: RatePrice[] = [];
    prices.forEach((p, k) => {
      let kind: PriceKind = kinds[k] ?? "fresh";
      if (seen.has(kind)) kind = kind === "fresh" ? "activated" : "fresh";
      if (seen.has(kind)) return;
      seen.add(kind);
      ps.push({ kind, value: p.value, start: p.start, end: p.end });
    });

    const line: RateLine = {
      n,
      text: t,
      more: "",
      brand: info.brand,
      brandKey: lettersOnly(info.brand),
      model: model || cleanModel(modelRaw),
      name,
      ram: variant?.ram ?? null,
      storage: variant?.storage ?? "",
      net,
      extras: extras.filter((e) => e && e.toLowerCase() !== "with"),
      notes,
      prices: ps,
      key: "",
    };
    line.key = makeKey(line);
    lines.push(line);
  });

  const seenKey = new Map<string, number[]>();
  for (const l of lines) for (const p of l.prices) seenKey.set(`${l.key}#${p.kind}`, [...(seenKey.get(`${l.key}#${p.kind}`) ?? []), l.n]);
  const duplicates = [...seenKey.entries()]
    .filter(([, ns]) => ns.length > 1)
    .map(([k, ns]) => ({ key: k.split("#")[0], kind: k.split("#")[1] as PriceKind, lines: ns }));

  return { lines, brands, skipped, duplicates };
}

/** Same product however it is spelt: "AI+ 2+" = "AI+ 2 Plus", "Spark 50 s" = "Spark 50s". */
export function productKey(brandKey: string, name: string) {
  const n = name
    .split(/\s+/)
    .map((w) => TYPOS[w.toLowerCase()] ?? w)
    .join(" ")
    .replace(/\+/g, " plus ");
  return `${brandKey}|${n.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function makeKey(l: Pick<RateLine, "brandKey" | "name" | "ram" | "storage" | "net" | "extras">) {
  return [productKey(l.brandKey, l.name), l.ram ?? "", l.storage.toLowerCase(), l.net.toLowerCase(), l.extras.map(lettersOnly).join("+")].join("|");
}

/** "4GB / 64GB · 5G · With Neckband" (the variant name in the shop) */
export function variantLabel(l: Pick<RateLine, "ram" | "storage" | "net" | "extras">): string {
  const size = l.ram && l.storage ? `${l.ram}GB / ${l.storage}` : l.storage;
  return [size, l.net, ...l.extras].filter(Boolean).join(" · ");
}

export function kindKey(l: RateLine, kind: PriceKind) {
  return `${l.key}#${kind}`;
}

const labelKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Finds the same model+variant in the app however it was typed. */
export function catalogKey(brand: string, name: string, label: string, kind: PriceKind) {
  return `${productKey(lettersOnly(brand), name)}|${labelKey(label)}#${kind}`;
}

export function lineCatalogKey(l: RateLine, kind: PriceKind) {
  return catalogKey(l.brand, l.name, variantLabel(l), kind);
}

/** Marked "❌ NA" in a message Mama made earlier. */
export function lineIsNA(l: RateLine) {
  return /❌/.test(l.text) || l.notes.includes("na") || l.notes.includes("n/a");
}

const inr = (n: number, like: string) => (like.includes(",") ? new Intl.NumberFormat("en-IN").format(n) : String(n));

/**
 * The same message with new prices. Everything else (spacing, headings, notes)
 * stays exactly as Mama wrote it. Lines marked not available get "❌ NA".
 */
export function renderRates(
  text: string,
  lines: RateLine[],
  newPrice: (l: RateLine, kind: PriceKind) => number | undefined,
  notAvailable: (l: RateLine) => boolean,
): string {
  const rows = text.replace(/\r/g, "").split("\n");
  for (const l of lines) {
    let row = l.text;
    for (const p of [...l.prices].sort((a, b) => b.start - a.start)) {
      const v = newPrice(l, p.kind);
      if (v !== undefined && v !== p.value) row = row.slice(0, p.start) + inr(v, row.slice(p.start, p.end)) + row.slice(p.end);
    }
    if (notAvailable(l) && !/❌/.test(row)) row = `${row.replace(/\s+$/, "")}  ❌ NA`;
    if (!notAvailable(l)) row = row.replace(/\s*❌ NA\s*$/, "");
    rows[l.n - 1] = row;
  }
  return rows.join("\n");
}

export const BRAND_COLORS: Record<string, string> = {
  Tecno: "#2563eb",
  itel: "#dc2626",
  "AI+": "#7c3aed",
  Nokia: "#0284c7",
  HMD: "#0284c7",
  Lava: "#ea580c",
  POCO: "#ca8a04",
  Infinix: "#16a34a",
  OPPO: "#059669",
  Redmi: "#f97316",
  Xiaomi: "#f97316",
  realme: "#eab308",
  Nothing: "#475569",
  vivo: "#1d4ed8",
  Samsung: "#1e3a8a",
  iQOO: "#0891b2",
  Motorola: "#0f766e",
  OnePlus: "#e11d48",
  Google: "#4f46e5",
  Mivi: "#9333ea",
  Apple: "#334155",
};
const FALLBACK = ["#2563eb", "#dc2626", "#7c3aed", "#059669", "#ea580c", "#0891b2", "#ca8a04", "#e11d48"];
export function brandColor(brand: string) {
  if (BRAND_COLORS[brand]) return BRAND_COLORS[brand];
  let h = 0;
  for (const c of brand) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
