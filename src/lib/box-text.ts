/**
 * Turns the text read from a phone box (photo → OCR) into specs + a short description.
 * Box labels in India print things like:
 *   "8GB RAM + 128GB ROM", "17.07 cm (6.72 inch) Display", "50MP + 2MP Rear Camera",
 *   "8MP Front", "5000mAh Battery", "45W", "Dimensity 7025", "Colour: Ocean Blue",
 *   "Model: CPH2723", "MRP ₹ 24,999.00 (Incl. of all taxes)".
 * OCR makes small mistakes (O↔0, l↔1, stray spaces), so the patterns are forgiving.
 * IMEI / serial numbers are ignored on purpose — they belong to one handset, not the model.
 */
export type BoxSpec = { label: string; value: string };
export type BoxResult = {
  specs: BoxSpec[];
  description: string;
  ram?: number; // GB
  storage?: number; // GB (1 TB = 1024)
  mrp?: number; // rupees
};

const clean = (s: string) =>
  s
    .replace(/\r/g, "")
    // OCR often reads "GB" as "G8"/"GE", "mAh" as "mAH"/"rnAh"
    .replace(/(\d)\s*G[8E]\b/g, "$1GB")
    .replace(/(\d|[Oo])\s*(?:rn|m)\s*A\s*[hH]\b/g, "$1mAh")
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/[ \t]+/g, " ");

// digits OCR'd as letters inside numbers: "5OOO" → "5000", "l28" → "128"
const fixNum = (s: string) => s.replace(/[Oo]/g, "0").replace(/[lI|]/g, "1").replace(/[Ss]/g, "5");

const PROCESSOR =
  /\b(Snapdragon\s*\d?\s*(?:Gen\s*\d|\d{3})\s*\+?|Dimensity\s*\d{3,4}\s*(?:\+|Ultra|Ultimate|Pro|Energy)?|Helio\s*[A-Z]\d{2,3}|Unisoc\s*(?:T|SC)?\s*\d{3,4}|Exynos\s*\d{3,4}|Tensor\s*G\d|A\d{2}\s*(?:Pro\s*)?Bionic|Tiger\s*T\d{3,4}|Kirin\s*\d{3,4})/i;

export function parseBoxText(raw: string, brand = "", model = ""): BoxResult {
  const text = clean(raw);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const all = lines.join("\n");
  const specs: BoxSpec[] = [];
  const add = (label: string, value: string | undefined | null) => {
    const v = value?.replace(/\s+/g, " ").trim();
    if (v && !specs.some((s) => s.label === label)) specs.push({ label, value: v });
  };
  const out: BoxResult = { specs, description: "" };

  // RAM + storage: "8GB+128GB", "8 GB RAM + 128 GB ROM", "RAM 8GB ROM 128GB", "8+128GB"
  let m =
    all.match(/(\d{1,2})\s*GB\s*(?:RAM)?\s*[+/|&]\s*(\d{2,4}|1|2)\s*(GB|TB)\s*(?:ROM|storage)?/i) ||
    all.match(/\b(\d{1,2})\s*[+/]\s*(\d{2,4})\s*(GB)\b/i);
  if (m) {
    out.ram = Number(m[1]);
    out.storage = Number(m[2]) * (/tb/i.test(m[3]) ? 1024 : 1);
  } else {
    const r = all.match(/RAM\s*[:\-]?\s*(\d{1,2})\s*GB|(\d{1,2})\s*GB\s*RAM/i);
    const s = all.match(/(?:ROM|storage|internal(?:\s*memory)?)\s*[:\-]?\s*(\d{2,4}|1|2)\s*(GB|TB)|(\d{2,4})\s*GB\s*(?:ROM|storage)/i);
    if (r) out.ram = Number(r[1] || r[2]);
    if (s) out.storage = s[3] ? Number(s[3]) : Number(s[1]) * (/tb/i.test(s[2] || "") ? 1024 : 1);
  }
  const size = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);
  if (out.ram || out.storage) add("RAM / Storage", [out.ram && `${out.ram}GB RAM`, out.storage && `${size(out.storage)} storage`].filter(Boolean).join(" + "));

  // Display: inches (with or without cm), plus refresh rate
  m =
    all.match(/(\d{1,2}[.,]\d{1,2})\s*(?:"|''|inch(?:es)?|in\b)/i) ||
    all.match(/\(\s*(\d{1,2}[.,]\d{1,2})\s*\)/) ||
    null;
  let inch = m ? Number(m[1].replace(",", ".")) : NaN;
  if (!(inch >= 4 && inch <= 9)) {
    const cm = all.match(/(\d{2}[.,]\d{1,2})\s*cm/i);
    inch = cm ? Math.round((Number(cm[1].replace(",", ".")) / 2.54) * 100) / 100 : NaN;
  }
  const hz = all.match(/(\d{2,3})\s*Hz/i);
  const panel = all.match(/\b(AMOLED|OLED|LCD|IPS|LTPO|Super AMOLED|pOLED)\b/i);
  if (inch >= 4 && inch <= 9) add("Display", [`${inch}"`, panel?.[1], hz && Number(hz[1]) >= 60 && Number(hz[1]) <= 240 ? `${hz[1]}Hz` : ""].filter(Boolean).join(" "));

  // Cameras: each part of a line ("50MP + 2MP Rear Camera | 8MP Front Camera",
  // "Rear 50MP+8MP  Front 13MP") that mentions front/selfie → front, the rest → rear
  const rear: number[] = [];
  const front: number[] = [];
  for (const l of lines) {
    for (const part of l.split(/\s*[|;•]\s*|\s{2,}/)) {
      const mps = [...part.matchAll(/(\d{1,3}(?:\.\d)?)\s*MP\b/gi)].map((x) => Number(x[1])).filter((n) => n >= 2 && n <= 200);
      if (mps.length) (/front|selfie/i.test(part) ? front : rear).push(...mps);
    }
  }
  const uniq = (a: number[]) => [...new Set(a)];
  if (rear.length) add("Rear camera", uniq(rear).map((n) => `${n}MP`).join(" + "));
  if (front.length) add("Front camera", uniq(front).map((n) => `${n}MP`).join(" + "));

  // Battery + charging
  m = all.match(/(\d[\dOolI]{3,4})\s*mAh/i);
  if (m) {
    const mah = Number(fixNum(m[1]));
    if (mah >= 1000 && mah <= 12000) add("Battery", `${mah} mAh`);
  }
  const watts = [...all.matchAll(/(\d{2,3})\s*W\b/g)].map((x) => Number(x[1])).filter((w) => w >= 10 && w <= 240);
  if (watts.length) add("Charging", `${Math.max(...watts)}W`);

  // Processor, network, software
  m = all.match(PROCESSOR);
  if (m) add("Processor", m[1].replace(/\s+/g, " "));
  else if (/octa[\s-]?core/i.test(all)) add("Processor", "Octa-core");
  if (/\b5G\b/.test(all)) add("Network", "5G");
  else if (/\b4G\b|\bLTE\b|VoLTE/i.test(all)) add("Network", "4G");
  m = all.match(/\b(Android\s*\d{1,2}|HyperOS\s*\d?|ColorOS\s*\d{1,2}|Funtouch\s*OS\s*\d{1,2}|One\s*UI\s*\d|OxygenOS\s*\d{1,2}|realme\s*UI\s*\d|HiOS\s*\d{1,2}|XOS\s*\d{1,2}|iOS\s*\d{2})/i);
  if (m) add("Software", m[1].replace(/\s+/g, " "));

  // Model number + colour + warranty (one line each; stop at the line's end)
  m = all.match(/Model\s*(?:No\.?|Number|Name)?\s*[:\-.]?\s*([A-Z0-9][A-Z0-9\-]{3,14})\b/i);
  if (m && /\d/.test(m[1]) && !/^\d{10,}$/.test(m[1])) add("Model no.", m[1].toUpperCase());
  m = all.match(/Colou?r\s*(?:name)?\s*[:\-.]?\s*([A-Za-z][A-Za-z ]{2,24})/i);
  if (m) add("Colour", m[1].replace(/\s+(RAM|ROM|Model|IMEI|MRP|Net|Qty).*$/i, "").trim());
  m = all.match(/(\d{1,2})\s*(year|yr|month)s?\s*(?:manufacturer'?s?|brand|limited)?\s*warranty/i);
  if (m) add("Warranty", `${m[1]} ${/month/i.test(m[2]) ? "months" : Number(m[1]) > 1 ? "years" : "year"} brand warranty`);

  // MRP (printed on every box) — "MRP ₹ 24,999.00", "M.R.P. Rs. 24999/-"
  m = all.match(/M\s*\.?\s*R\s*\.?\s*P[^0-9\n]{0,25}([\d,OolI]{3,9})(?:\.\d{2})?/i);
  if (m) {
    const mrp = Number(fixNum(m[1]).replace(/,/g, ""));
    if (mrp >= 500 && mrp <= 500000) {
      out.mrp = mrp;
      add("MRP", `₹${mrp.toLocaleString("en-IN")}`);
    }
  }

  const get = (l: string) => specs.find((s) => s.label === l)?.value;
  out.description = [
    [brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? brand : "", model].filter(Boolean).join(" "),
    out.ram && out.storage ? `${out.ram}GB + ${size(out.storage)}` : "",
    get("Display") && `${get("Display")} display`,
    get("Processor"),
    get("Rear camera") && `${get("Rear camera")} camera`,
    get("Battery") && `${get("Battery")} battery${get("Charging") ? ` with ${get("Charging")} charging` : ""}`,
    get("Network"),
    get("Colour"),
    get("Model no.") && `Model no. ${get("Model no.")}`,
    get("Warranty"),
  ]
    .filter(Boolean)
    .join(" · ");
  return out;
}
