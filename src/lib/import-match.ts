// Excel / Tally import: read columns and match each row to Mama's models.
// Pure functions (run in the browser so 1000s of rows match instantly).

export type VariantRef = {
  id: number;
  productId: number;
  name: string;
  brand: string;
  label: string;
  modelNumber: string;
  price: number;
  mrp: number | null;
  stock: number;
};

export const FIELDS = ["id", "name", "variant", "model", "price", "mrp", "stock"] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Record<Field, number>; // column index, -1 = not used

const HEADER_WORDS: Record<Field, RegExp> = {
  id: /^(id|variant\s*id|la\s*id)\b/i,
  name: /particular|stock\s*item|item\s*name|^item$|product|model\s*name|^model$|^name$|description|^items?\b/i,
  variant: /variant|storage|ram|config|memory/i,
  model: /model\s*(no|number|code)|part\s*no|sku|item\s*code|^code$|hsn/i,
  price: /wholesale|dealer|selling|sale\s*rate|^rate$|price|\bdp\b|nlc|rate/i,
  mrp: /\bmrp\b|m\.r\.p/i,
  stock: /closing|quantity|^qty|stock|balance|pcs|nos/i,
};

const isWord = (c: string) => !!c && Object.values(HEADER_WORDS).some((re) => re.test(c.trim()));
const headerScore = (r: string[] = []) => r.filter(isWord).length;
/** A header-looking row: has header words and no numbers in it. */
const headerish = (r?: string[]) => !!r && headerScore(r) > 0 && !r.some((c) => /\d/.test(c) && parseNumber(c) !== null);

/** Finds the header row (Tally puts a title + company name above it, and splits headers over 2 rows). */
export function findHeader(rows: string[][]): { index: number; headers: string[] } {
  let best = { index: 0, score: -1 };
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const score = headerScore(rows[i]);
    if (score > best.score) best = { index: i, score };
  }
  const i = best.score >= 1 ? best.index : 0;
  const width = Math.max(...rows.slice(0, 40).map((r) => r.length), 0);
  // merged headers: "Closing Balance" on one row, "Quantity | Rate | Value" under it
  let top: string[] = [];
  let sub = rows[i] ?? [];
  let index = i;
  if (headerish(rows[i + 1])) {
    top = rows[i];
    sub = rows[i + 1];
    index = i + 1;
  } else if (i > 0 && headerish(rows[i - 1])) {
    top = rows[i - 1];
  }
  const headers = Array.from({ length: width }, (_, c) => {
    const t = fillLeft(top, c).trim();
    const own = (sub[c] ?? "").trim();
    return [t && t !== own ? t : "", own].filter(Boolean).join(" ").trim();
  });
  return { index, headers };
}

/** A merged cell spreads to the right: "Closing Balance" covers Quantity, Rate, Value. */
function fillLeft(row: string[], c: number) {
  if (row[c]) return row[c];
  for (let k = c - 1; k >= 1 && k >= c - 3; k--) if (row[k]) return row[k];
  return "";
}

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = { id: -1, name: -1, variant: -1, model: -1, price: -1, mrp: -1, stock: -1 };
  const used = new Set<number>();
  const order: Field[] = ["id", "mrp", "model", "variant", "stock", "price", "name"];
  for (const f of order) {
    const idx = headers.findIndex((h, i) => !used.has(i) && h && HEADER_WORDS[f].test(h));
    if (idx >= 0) {
      // "Closing Balance Rate" is Tally's cost value, prefer a plain rate/price column
      if (f === "stock" && /rate|value|amount/i.test(headers[idx])) continue;
      m[f] = idx;
      used.add(idx);
    }
  }
  if (m.stock >= 0 && /value|amount/i.test(headers[m.stock])) m.stock = -1;
  if (m.name < 0) m.name = headers.findIndex((h, i) => !used.has(i));
  return m;
}

/** "₹ 1,12,000.00" → 112000 · "12 Nos" → 12 · "(-2) pcs" → -2 · "" → null */
export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s0 = String(raw).trim();
  if (!s0) return null;
  const s = s0.split("/")[0].replace(/,/g, "");
  const m = s.match(/(-?)\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const neg = m[1] === "-" || /^\(.*\)/.test(s0);
  const n = Math.round(Number(m[2]));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

const FILLER = new Set(["gb", "ram", "rom", "storage", "the", "with", "and", "mobile", "phone", "smartphone", "inch", "inches", "nos", "pcs", "pc", "new", "dual", "sim", "lte", "of", "in", "x"]);
const OPTIONAL = new Set(["5g", "4g", "galaxy"]);
const STORAGE = new Set(["16", "32", "64", "128", "256", "512", "1024", "1tb", "2tb"]);
const MODIFIERS = new Set(["pro", "max", "plus", "ultra", "mini", "lite", "fe", "neo", "prime", "power", "play", "edge", "fold", "flip", "air", "se", "turbo", "slim"]);

/** "Galaxy S24 Ultra 12GB / 256GB" → ["galaxy","s24","ultra","12","256"] */
export function tokens(text: string): string[] {
  const s = text
    .toLowerCase()
    .replace(/(\d)\s*gb\b/g, "$1 ")
    .replace(/(\d)\s*tb\b/g, "$1tb ")
    .replace(/(\d)\s*(inch(es)?|"|”|″)/g, "$1 ")
    .replace(/\+/g, " plus ")
    .replace(/(\d) plus (\d)/g, "$1 $2") // "8+128"
    .replace(/[^a-z0-9]+/g, " ");
  return s.split(" ").filter((w) => w && !FILLER.has(w));
}

const hasDigit = (w: string) => /\d/.test(w);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Index = {
  refs: VariantRef[];
  byId: Map<number, VariantRef>;
  byModel: Map<string, VariantRef>;
  toks: Map<number, string[]>;
  labelToks: Map<number, string[]>;
  modelKey: Map<number, string>;
  inverted: Map<string, number[]>;
  brands: Set<string>;
  brandOf: Map<number, string[]>;
};

export function buildIndex(refs: VariantRef[]): Index {
  const byId = new Map(refs.map((r) => [r.id, r]));
  const byModel = new Map<string, VariantRef>();
  const toks = new Map<number, string[]>();
  const labelToks = new Map<number, string[]>();
  const modelKey = new Map<number, string>();
  const inverted = new Map<string, number[]>();
  const brands = new Set<string>();
  const brandOf = new Map<number, string[]>();
  // a model number shared by several variants (S24 Ultra 256/512/1TB) cannot pick one
  const seen = new Map<string, number>();
  for (const r of refs) if (r.modelNumber) seen.set(norm(r.modelNumber), (seen.get(norm(r.modelNumber)) ?? 0) + 1);
  for (const r of refs) {
    const mn = norm(r.modelNumber);
    if (mn.length >= 4 && seen.get(mn) === 1) byModel.set(mn, r);
    if (mn.length >= 4) modelKey.set(r.id, mn);
    const tk = [...new Set(tokens(`${r.brand} ${r.name} ${r.label}`))];
    toks.set(r.id, tk);
    labelToks.set(r.id, tokens(r.label));
    const bt = tokens(r.brand);
    brandOf.set(r.id, bt);
    for (const w of bt) brands.add(w);
    for (const w of [...tk, ...(mn.length >= 4 ? [mn, ...tokens(r.modelNumber)] : [])]) {
      const list = inverted.get(w) ?? [];
      if (!list.includes(r.id)) inverted.set(w, [...list, r.id]);
    }
  }
  return { refs, byId, byModel, toks, labelToks, modelKey, inverted, brands, brandOf };
}

export type Match = { ref: VariantRef; confidence: "exact" | "good" | "check" };

export function matchRow(idx: Index, cells: { id?: string; text: string; model?: string }): Match | null {
  const id = parseNumber(cells.id);
  if (id && idx.byId.has(id)) return { ref: idx.byId.get(id)!, confidence: "exact" };
  if (cells.model) {
    const r = idx.byModel.get(norm(cells.model));
    if (r) return { ref: r, confidence: "exact" };
  }
  const rowTok = [...new Set(tokens(cells.text))];
  if (!rowTok.length) return null;
  for (const w of rowTok) {
    const r = w.length >= 5 && hasDigit(w) ? idx.byModel.get(w) : undefined;
    if (r) return { ref: r, confidence: "exact" };
  }
  const row = new Set(rowTok);
  const rowNorm = norm(cells.text);
  const candidates = new Set<number>();
  for (const w of rowTok) for (const vid of idx.inverted.get(w) ?? []) candidates.add(vid);

  const scored: { ref: VariantRef; score: number; cover: number }[] = [];
  for (const vid of candidates) {
    const vt = idx.toks.get(vid)!;
    // row names the model number (e.g. "SM-S928B 12/256"): only RAM/storage must agree
    const mk = idx.modelKey.get(vid);
    if (mk && rowNorm.includes(mk)) {
      const lt = idx.labelToks.get(vid)!;
      const vSetM = new Set(vt);
      if (lt.every((w) => row.has(w)) && !rowTok.some((w) => STORAGE.has(w) && !vSetM.has(w))) {
        scored.push({ ref: idx.byId.get(vid)!, score: 1, cover: 1 });
      }
      continue;
    }
    // every number in the model (S24, 12, 256 …) must be in the row
    if (vt.some((w) => hasDigit(w) && !OPTIONAL.has(w) && !row.has(w))) continue;
    // the row names a brand ("VIVO …") → it must be this model's brand
    const rowBrands = rowTok.filter((w) => idx.brands.has(w));
    const vb = idx.brandOf.get(vid) ?? [];
    if (rowBrands.length && vb.length && !vb.some((w) => rowBrands.includes(w))) continue;
    // at least one real model word must match (not just "8" and "128")
    const modelWords = vt.filter((w) => !vb.includes(w) && !STORAGE.has(w) && !/^\d{1,2}$/.test(w) && !OPTIONAL.has(w));
    if (modelWords.length && !modelWords.some((w) => row.has(w))) continue;
    // "Pro", "Ultra", "Max"… must agree both ways
    const vMods = vt.filter((w) => MODIFIERS.has(w));
    const rMods = rowTok.filter((w) => MODIFIERS.has(w));
    if (vMods.some((w) => !row.has(w)) || rMods.some((w) => !vt.includes(w))) continue;
    // a storage size in the row that this variant does not have = a different variant
    const vSet = new Set(vt);
    if (vt.some((w) => STORAGE.has(w)) && rowTok.some((w) => STORAGE.has(w) && !vSet.has(w))) continue;
    const core = vt.filter((w) => !OPTIONAL.has(w));
    const hit = core.filter((w) => row.has(w)).length;
    const score = core.length ? hit / core.length : 0;
    const cover = rowTok.filter((w) => vSet.has(w)).length / rowTok.length;
    if (score >= 0.5) scored.push({ ref: idx.byId.get(vid)!, score, cover });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score || b.cover - a.cover);
  const [a, b] = scored;
  const gap = b ? a.score - b.score + (a.cover - b.cover) / 2 : 1;
  const confidence = a.score === 1 && gap > 0.05 ? "good" : a.score >= 0.6 && gap >= 0.1 ? "good" : "check";
  return { ref: a.ref, confidence };
}

const SKIP_ROW = /^(grand\s*)?total\b|^opening|^closing|^sub\s*total|^page\s*\d/i;

export type ImportRow = {
  line: number;
  text: string;
  idCell: string;
  model: string;
  variantCell: string;
  price: number | null;
  mrp: number | null;
  stock: number | null;
};

/** Turns sheet rows into import rows using the chosen columns. */
export function readRows(rows: string[][], headerIndex: number, m: Mapping): ImportRow[] {
  const out: ImportRow[] = [];
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = get(r, m.name);
    const variantCell = get(r, m.variant);
    if (!name || SKIP_ROW.test(name)) continue;
    const price = parseNumber(get(r, m.price));
    const mrp = parseNumber(get(r, m.mrp));
    const stock = parseNumber(get(r, m.stock));
    // group headings in Tally ("Samsung", "Mobiles") have no numbers
    if (price === null && stock === null && mrp === null) continue;
    out.push({
      line: i + 1,
      text: [name, variantCell].filter(Boolean).join(" "),
      idCell: get(r, m.id),
      model: get(r, m.model),
      variantCell,
      price: price !== null && price > 0 ? price : null,
      mrp: mrp !== null && mrp > 0 ? mrp : null,
      stock: stock !== null ? Math.max(0, stock) : null,
    });
  }
  return out;
}

export function colName(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
