/**
 * Loads a whole rate message (text file) into the app on this laptop:
 *   npm run rates:import -- path\to\rates.txt     (stop `npm run dev` first)
 * Saves it as the Old message on the Update Rates page and adds every phone
 * that is not in the app yet (shown to retailers as "In stock").
 */
import { readFile } from "node:fs/promises";
import { importRateMessage } from "../src/lib/rate-import";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Give the text file, e.g. npm run rates:import -- rates.txt");
  const r = await importRateMessage(await readFile(file, "utf8"));
  console.log(`✓ ${r.lines} lines · ${r.brands} brands read`);
  console.log(`✓ ${r.products} phones added (${r.variants} prices) · ${r.already} were already in the app`);
  if (r.duplicates.length) console.log(`! written twice: lines ${r.duplicates.map((d) => d.lines.join(" & ")).join(", ")}`);
  process.exit(0);
}
main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
