/**
 * Write supabase/seed.sql from data/catalog.json (idempotent upserts).
 * Load it with the Supabase CLI (`supabase db reset`) or psql using a
 * service-role connection. The file is generated, so it is not committed.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { catalogToSql } from "../src/lib/ingest/sql";
import type { Catalog } from "../src/lib/types";

const ROOT = path.resolve(__dirname, "..");

async function main() {
  const catalog = JSON.parse(await readFile(path.join(ROOT, "data/catalog.json"), "utf8")) as Catalog;
  const sql = catalogToSql(catalog);
  await writeFile(path.join(ROOT, "supabase/seed.sql"), sql);
  process.stdout.write(`[seed] supabase/seed.sql: ${catalog.recipes.length} recipes, ${(sql.length / 1024 / 1024).toFixed(1)} MB\n`);
}

main().catch((error) => {
  process.stderr.write(`[seed] FAILED: ${String(error)}\n`);
  process.exit(1);
});
