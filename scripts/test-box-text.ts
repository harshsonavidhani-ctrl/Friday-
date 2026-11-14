// Checks the box-label reader on realistic box texts (incl. typical OCR mistakes).
import { parseBoxText } from "../src/lib/box-text";

let fails = 0;
function expect(name: string, raw: string, want: Record<string, string>, extra?: { ram?: number; storage?: number; mrp?: number }) {
  const r = parseBoxText(raw, "OPPO", "OPPO A6 5G");
  const got = Object.fromEntries(r.specs.map((s) => [s.label, s.value]));
  const bad = Object.entries(want).filter(([k, v]) => got[k] !== v).map(([k, v]) => `${k}: want "${v}" got "${got[k] ?? "-"}"`);
  for (const [k, v] of Object.entries(extra ?? {})) if ((r as Record<string, unknown>)[k] !== v) bad.push(`${k}: want ${v} got ${(r as Record<string, unknown>)[k]}`);
  if (got.IMEI || /\b\d{15}\b/.test(JSON.stringify(r))) bad.push("IMEI leaked");
  console.log(`${bad.length ? "FAIL" : "PASS"}  ${name}${bad.length ? "\n      " + bad.join("\n      ") : ""}`);
  if (bad.length) fails++;
  return r;
}

const r1 = expect(
  "OPPO side label",
  `OPPO A6 5G
Model: CPH2723
Colour: Sapphire Blue
8GB RAM + 128GB ROM
17.07 cm (6.72 inch) Display  120Hz
50MP + 2MP Rear Camera | 8MP Front Camera
6000mAh Battery 45W SUPERVOOC
MediaTek Dimensity 6300 5G
ColorOS 15 based on Android 15
IMEI1: 861234567890123
IMEI2: 861234567890131
MRP ₹ 18,999.00 (Incl. of all taxes)
1 Year Manufacturer Warranty`,
  {
    "RAM / Storage": "8GB RAM + 128GB storage",
    Display: '6.72" 120Hz',
    "Rear camera": "50MP + 2MP",
    "Front camera": "8MP",
    Battery: "6000 mAh",
    Charging: "45W",
    Processor: "Dimensity 6300",
    Network: "5G",
    Software: "ColorOS 15",
    "Model no.": "CPH2723",
    Colour: "Sapphire Blue",
    Warranty: "1 year brand warranty",
    MRP: "₹18,999",
  },
  { ram: 8, storage: 128, mrp: 18999 },
);
console.log("      description:", r1.description);

expect(
  "Samsung, OCR mistakes (G8, 5OOO, rnAh, M.R.P.)",
  `SAMSUNG Galaxy A26 5G SM-A266B/DS
Colour : Awesome Black
RAM 8 G8 | ROM 256 GB
16.95cm (6.7") Super AMOLED 120 Hz
Rear 50MP+8MP+2MP  Front 13MP
5OOO rnAh battery  25W
Exynos 1380  One UI 7
M.R.P. Rs. 2399O/- inclusive of all taxes`,
  { "RAM / Storage": "8GB RAM + 256GB storage", Display: '6.7" Super AMOLED 120Hz', Battery: "5000 mAh", Charging: "25W", Processor: "Exynos 1380", Software: "One UI 7", Colour: "Awesome Black" },
  { ram: 8, storage: 256, mrp: 23990 },
);

expect(
  "Tecno 4G short label",
  `TECNO SPARK 50
4GB+64GB  Space Grey
6.67" 90Hz | 13MP AI Camera | 5000mAh | 18W
Helio G81  4G VoLTE  HiOS 15
MRP Rs 9,499`,
  { "RAM / Storage": "4GB RAM + 64GB storage", Display: '6.67" 90Hz', "Rear camera": "13MP", Battery: "5000 mAh", Charging: "18W", Processor: "Helio G81", Network: "4G", Software: "HiOS 15" },
  { mrp: 9499 },
);

expect("1TB storage", `12GB + 1TB  Snapdragon 8 Gen 3`, { "RAM / Storage": "12GB RAM + 1TB storage", Processor: "Snapdragon 8 Gen 3" }, { storage: 1024 });
expect("nothing useful", `Made in India  Marketed by XYZ Pvt Ltd  Customer care 1800-000-000`, {});

console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
