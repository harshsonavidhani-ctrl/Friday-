/**
 * Full backup of the LIVE database (every table) into JSON files on this laptop.
 * Read-only: it never changes the live data.
 *
 *   npm run db:backup                 → C:\Users\<you>\laxmi-backups\live-<date-time>\
 *   npm run db:backup -- D:\backups   → another folder (e.g. a pen drive)
 *
 * Keep a copy somewhere else too (Google Drive / pen drive). The files contain
 * phone numbers and password hashes — do not share them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL — run with the live settings: npx tsx --env-file=.env.live scripts/backup-db.ts");
  // India time in the folder name, e.g. live-2026-11-13_03-15
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16).replace(" ", "_").replace(":", "-");
  const dir = path.resolve(process.argv[2] || path.join(os.homedir(), "laxmi-backups"), `live-${stamp}`);
  await mkdir(dir, { recursive: true });

  const sql = postgres(url, { prepare: false, max: 1 });
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
  const counts: Record<string, number> = {};
  for (const { table_name } of tables) {
    const rows = await sql.unsafe(`select * from "${table_name.replace(/"/g, '""')}"`);
    counts[table_name] = rows.length;
    await writeFile(path.join(dir, `${table_name}.json`), JSON.stringify(rows, null, 1), "utf8");
  }
  await writeFile(
    path.join(dir, "_backup-info.json"),
    JSON.stringify({ takenAt: new Date().toISOString(), host: new URL(url).hostname, tables: counts }, null, 2),
    "utf8",
  );
  await sql.end();
  console.log(`✓ Backup saved: ${dir}`);
  for (const [t, n] of Object.entries(counts)) console.log(`  ${t}: ${n}`);
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
