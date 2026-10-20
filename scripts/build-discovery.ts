/**
 * Derive the lightweight browser index (public/data/discovery.json) from the
 * committed catalogue. Runs automatically before `next build` and `next dev`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { toDiscoveryIndex } from "../src/lib/catalog-shared";
import type { Catalog } from "../src/lib/types";

const ROOT = path.resolve(__dirname, "..");

async function main() {
  const catalog = JSON.parse(await readFile(path.join(ROOT, "data/catalog.json"), "utf8")) as Catalog;
  const index = toDiscoveryIndex(catalog);
  const out = path.join(ROOT, "public/data/discovery.json");
  await mkdir(path.dirname(out), { recursive: true });
  const json = JSON.stringify(index);
  await writeFile(out, json);
  process.stdout.write(`[discovery] ${index.recipes.length} recipes, ${index.ingredients.length} ingredients, ${(json.length / 1024).toFixed(0)} KB\n`);
}

main().catch((error) => {
  process.stderr.write(`[discovery] FAILED: ${String(error)}\n`);
  process.exit(1);
});
