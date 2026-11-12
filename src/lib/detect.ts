// Smart helpers for "Add model": guess brand, category and variant from
// what Mama types, e.g. "S24 Ultra 12/256" -> Samsung, Mobiles, 12GB / 256GB.
// Pure functions, used live in the browser while typing.

export type CategoryKey =
  | "mobile"
  | "tablet"
  | "tv"
  | "oven"
  | "fridge"
  | "washing"
  | "ac"
  | "audio"
  | "watch"
  | "laptop"
  | "kitchen"
  | "accessory";

const BRAND_RULES: [RegExp, string][] = [
  [/\bi\s?phone\b|\bipad\b|\bmacbook\b|\bairpods?\b|\bapple\b/i, "Apple"],
  [/\bredmi\b/i, "Redmi"],
  [/\bpoco\b/i, "POCO"],
  [/\bxiaomi\b|\bmi\s?(tv|band|smart|pad)\b/i, "Xiaomi"],
  [/\biqoo\b/i, "iQOO"],
  [/\bvivo\b/i, "Vivo"],
  [/\boppo\b/i, "OPPO"],
  [/\brealme\b|\bnarzo\b/i, "realme"],
  [/\bone\s?plus\b|\bnord\b/i, "OnePlus"],
  [/\bmoto(rola)?\b/i, "Motorola"],
  [/\bpixel\b|\bgoogle\b/i, "Google"],
  [/\bnothing\b|\bcmf\b/i, "Nothing"],
  [/\bnokia\b/i, "Nokia"],
  [/\btecno\b/i, "Tecno"],
  [/\binfinix\b/i, "Infinix"],
  [/\bitel\b/i, "itel"],
  [/\blava\b/i, "Lava"],
  [/\bhonor\b/i, "Honor"],
  [/\bsony\b|\bbravia\b/i, "Sony"],
  [/\blg\b/i, "LG"],
  [/\btcl\b/i, "TCL"],
  [/\bhisense\b/i, "Hisense"],
  [/\bpanasonic\b/i, "Panasonic"],
  [/\bphilips\b/i, "Philips"],
  [/\bwhirlpool\b/i, "Whirlpool"],
  [/\bgodrej\b/i, "Godrej"],
  [/\bhaier\b/i, "Haier"],
  [/\bvoltas\b/i, "Voltas"],
  [/\bdaikin\b/i, "Daikin"],
  [/\bblue\s?star\b/i, "Blue Star"],
  [/\bifb\b/i, "IFB"],
  [/\bbosch\b/i, "Bosch"],
  [/\bbajaj\b/i, "Bajaj"],
  [/\bhavells\b/i, "Havells"],
  [/\bprestige\b/i, "Prestige"],
  [/\bmorphy\s?richards\b/i, "Morphy Richards"],
  [/\bboat\b|\bairdopes\b|\brockerz\b/i, "boAt"],
  [/\bjbl\b/i, "JBL"],
  [/\bnoise\b/i, "Noise"],
  [/\bfire-?boltt\b/i, "Fire-Boltt"],
  // Samsung last: its model codes (S24, A15, M35, F15, Z Fold) are short
  [/\bsamsung\b|\bgalaxy\b|\bz\s?(fold|flip)\s?\d*\b|\b[samf]\d{2}\b/i, "Samsung"],
];

const PHONE_BRANDS = new Set([
  "Samsung", "Apple", "Redmi", "POCO", "Xiaomi", "iQOO", "Vivo", "OPPO", "realme",
  "OnePlus", "Motorola", "Google", "Nothing", "Nokia", "Tecno", "Infinix", "itel",
  "Lava", "Honor",
]);

const CATEGORY_RULES: [RegExp, CategoryKey][] = [
  [/\b(charger|cable|adapter|power\s?bank|back\s?cover|cover|case|tempered|screen\s?guard|memory\s?card|pen\s?drive|otg\s?cable)\b/i, "accessory"],
  [/\b(ac|air\s?conditioner|split|window\s?ac|\d(\.\d)?\s?ton)\b/i, "ac"],
  [/\b(tv|television|oled|qled|bravia)\b|\b\d{2,3}\s?(inch|inches|")/i, "tv"],
  [/\b(microwave|oven|otg|convection)\b/i, "oven"],
  [/\b(refrigerator|fridge|double\s?door|single\s?door|side\s?by\s?side)\b/i, "fridge"],
  [/\b(washing\s?machine|washer|front\s?load|top\s?load|semi[-\s]?automatic)\b/i, "washing"],
  [/\b(speaker|soundbar|earbuds|buds|airdopes|tws|headphones?|earphones?|neckband|airpods?|rockerz|home\s?theat(er|re))\b/i, "audio"],
  [/\b(smart\s?watch|watch|band)\b/i, "watch"],
  [/\b(ipad|tablet|tab|pad)\b/i, "tablet"],
  [/\b(laptop|macbook|notebook|chromebook)\b/i, "laptop"],
  [/\b(mixer|grinder|juicer|kettle|induction|toaster|air\s?fryer|cooktop|chimney)\b/i, "kitchen"],
  [/\b(phone|mobile|5g|4g|iphone|galaxy|redmi|pixel|pro\s?max|ultra)\b|\b\d{1,2}\s?(gb)?\s?[/+]\s?\d{2,4}/i, "mobile"],
];

/** How each key finds Mama's category by its name (categories are editable). */
export const CATEGORY_NAME_MATCH: Record<CategoryKey, RegExp> = {
  mobile: /mobile|phone/i,
  tablet: /tablet/i,
  tv: /\btv|television/i,
  oven: /oven|microwave/i,
  fridge: /fridge|refrigerator/i,
  washing: /washing/i,
  ac: /\bac\b|air\s?condition/i,
  audio: /audio|speaker|sound|earbud|headphone/i,
  watch: /watch|wearable/i,
  laptop: /laptop|computer/i,
  kitchen: /kitchen/i,
  accessory: /accessor/i,
};

export function detectBrand(text: string): string {
  for (const [re, brand] of BRAND_RULES) if (re.test(text)) return brand;
  return "";
}

export function detectCategoryKey(text: string, brand = detectBrand(text)): CategoryKey | null {
  for (const [re, key] of CATEGORY_RULES) if (re.test(text)) return key;
  if (PHONE_BRANDS.has(brand)) return "mobile";
  return null;
}

export function categoryKeyFromName(name: string): CategoryKey | null {
  for (const [key, re] of Object.entries(CATEGORY_NAME_MATCH)) {
    if (re.test(name)) return key as CategoryKey;
  }
  return null;
}

export function findCategoryId(
  key: CategoryKey | null,
  cats: { id: number; name: string }[],
): number | null {
  if (!key) return null;
  return cats.find((c) => CATEGORY_NAME_MATCH[key].test(c.name))?.id ?? null;
}

/**
 * Pulls a RAM/storage variant out of the typed name.
 * "S24 Ultra 12/256" -> { label: "12GB / 256GB", rest: "S24 Ultra" }
 * "iPhone 16 128GB"  -> { label: "128GB", rest: "iPhone 16" }
 */
export function parseVariant(text: string): { label: string; rest: string } | null {
  const cut = (m: RegExpMatchArray) =>
    (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length))
      .replace(/\s+/g, " ")
      .trim();

  const ramRom = text.match(/\b(\d{1,2})\s*(?:gb)?\s*[/+]\s*(\d{1,4})\s*(gb|tb)?\b/i);
  if (ramRom) {
    const ram = Number(ramRom[1]);
    const storage = Number(ramRom[2]);
    const unit = (ramRom[3] || (storage <= 2 ? "TB" : "GB")).toUpperCase();
    if (ram >= 1 && ram <= 24 && (unit === "TB" || storage >= 16)) {
      return { label: `${ram}GB / ${storage}${unit}`, rest: cut(ramRom) };
    }
  }
  const rom = text.match(/\b(32|64|128|256|512|1|2)\s*(gb|tb)\b/i);
  if (rom) {
    return { label: `${rom[1]}${rom[2].toUpperCase()}`, rest: cut(rom) };
  }
  return null;
}

export const SPEC_TEMPLATES: Record<CategoryKey | "other", string[]> = {
  mobile: ["Display", "Processor", "Rear Camera", "Front Camera", "Battery", "Network", "Colours", "Warranty"],
  tablet: ["Display", "Processor", "Battery", "Connectivity", "Colours", "Warranty"],
  tv: ["Screen Size", "Resolution", "Display Type", "Smart OS", "Refresh Rate", "Sound Output", "Ports", "Warranty"],
  oven: ["Type", "Capacity", "Power", "Control", "Warranty"],
  fridge: ["Capacity", "Type", "Star Rating", "Compressor", "Colour", "Warranty"],
  washing: ["Capacity", "Type", "Star Rating", "Max Spin Speed", "Warranty"],
  ac: ["Capacity", "Type", "Star Rating", "Compressor", "Condenser", "Warranty"],
  audio: ["Type", "Connectivity", "Battery Life", "Colours", "Warranty"],
  watch: ["Display", "Battery Life", "Connectivity", "Colours", "Warranty"],
  laptop: ["Processor", "RAM", "Storage", "Display", "Graphics", "OS", "Warranty"],
  kitchen: ["Type", "Capacity", "Power", "Warranty"],
  accessory: ["Type", "Compatible With", "Warranty"],
  other: ["Warranty"],
};

/** One-tap variant chips on the Add Model screen. */
export const VARIANT_CHIPS: Partial<Record<CategoryKey, string[]>> = {
  mobile: ["4GB / 64GB", "4GB / 128GB", "6GB / 128GB", "8GB / 128GB", "8GB / 256GB", "12GB / 256GB", "12GB / 512GB", "12GB / 1TB", "128GB", "256GB", "512GB"],
  tablet: ["4GB / 64GB", "6GB / 128GB", "8GB / 128GB", "8GB / 256GB", "128GB", "256GB"],
  tv: ['32"', '40"', '43"', '50"', '55"', '65"', '75"'],
  ac: ["1 Ton", "1.5 Ton", "2 Ton"],
  oven: ["20L", "23L", "25L", "28L", "32L"],
  washing: ["6 kg", "7 kg", "8 kg", "9 kg", "10 kg"],
  fridge: ["190L", "240L", "260L", "320L", "650L"],
};
