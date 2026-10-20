/**
 * Repeatable TheMealDB importer.
 *
 *   npm run import:mealdb                 # fetch, map, check videos
 *   npm run import:mealdb -- --skip-video-check
 *
 * Uses the official JSON API only (no website scraping). Set MEALDB_API_KEY
 * to a supporter key for production use; the default "1" is TheMealDB's
 * development / educational key.
 *
 * Outputs (committed so builds are reproducible):
 *   data/catalog.json        unified catalogue
 *   data/import-report.json  counts, flags, skipped records
 *   data/video-checks.json   cached YouTube oEmbed availability checks
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mapMealDb, type MealDbIngredient, type MealDbMeal, type VideoCheck } from "../src/lib/ingest/themealdb";
import { youtubeIdFromUrl } from "../src/lib/ingest/normalize";

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const API_KEY = process.env.MEALDB_API_KEY || "1";
const BASE = `https://www.themealdb.com/api/json/v1/${API_KEY}`;
const VIDEO_RECHECK_DAYS = 30;
const skipVideoCheck = process.argv.includes("--skip-video-check");

function log(message: string) {
  process.stdout.write(`[import] ${message}\n`);
}

async function fetchJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  // Never log the URL itself: it contains the API key.
  throw new Error(`Request failed after ${attempts} attempts: ${String(lastError)}`);
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function checkVideos(ids: string[], cache: Record<string, VideoCheck>) {
  const now = Date.now();
  const stale = ids.filter((id) => {
    const c = cache[id];
    return !c || now - Date.parse(c.checkedAt) > VIDEO_RECHECK_DAYS * 86_400_000;
  });
  log(`video checks: ${ids.length} linked, ${stale.length} need (re)checking`);
  let done = 0;
  const failures: string[] = [];
  const queue = [...stale];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (res.ok) {
          const body = (await res.json()) as { title?: string; author_name?: string };
          cache[id] = { status: "ok", title: body.title ?? null, channelTitle: body.author_name ?? null, checkedAt: new Date().toISOString() };
        } else if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
          // 401/403: private or embedding disabled; 404/400: removed or invalid.
          cache[id] = { status: "unavailable", title: null, channelTitle: null, checkedAt: new Date().toISOString() };
        } else {
          failures.push(`${id}: HTTP ${res.status}`);
        }
      } catch (error) {
        failures.push(`${id}: ${String(error)}`);
      }
      if (++done % 100 === 0) log(`  checked ${done}/${stale.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (failures.length) log(`  ${failures.length} checks failed (kept as unchecked); first: ${failures[0]}`);
  return failures;
}

async function main() {
  await mkdir(DATA, { recursive: true });
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const meals: MealDbMeal[] = [];
  const failures: string[] = [];
  for (const letter of letters) {
    try {
      const body = await fetchJson<{ meals: MealDbMeal[] | null }>(`${BASE}/search.php?f=${letter}`);
      meals.push(...(body.meals ?? []));
    } catch (error) {
      failures.push(`letter ${letter}: ${String(error)}`);
    }
  }
  if (failures.length > 0) {
    // A partial catalogue would silently drop recipes; refuse to write one.
    throw new Error(`Aborting import, ${failures.length} letter requests failed:\n${failures.join("\n")}`);
  }
  log(`fetched ${meals.length} meal records`);

  const ingredientBody = await fetchJson<{ meals: MealDbIngredient[] | null }>(`${BASE}/list.php?i=list`);
  const ingredientList = ingredientBody.meals ?? [];
  log(`fetched ${ingredientList.length} ingredient records`);

  const videoCachePath = path.join(DATA, "video-checks.json");
  const videoChecks = await readJson<Record<string, VideoCheck>>(videoCachePath, {});
  let videoFailures: string[] = [];
  if (!skipVideoCheck) {
    const ids = [...new Set(meals.map((m) => youtubeIdFromUrl(m.strYoutube)).filter((id): id is string => !!id))];
    videoFailures = await checkVideos(ids, videoChecks);
    const sorted = Object.fromEntries(Object.entries(videoChecks).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(videoCachePath, JSON.stringify(sorted, null, 1) + "\n");
  }

  const generatedAt = new Date().toISOString();
  const { catalog, report } = mapMealDb(meals, ingredientList, videoChecks, generatedAt);
  if (catalog.recipes.length === 0) throw new Error("Import produced zero recipes; refusing to overwrite catalogue.");

  await writeFile(path.join(DATA, "catalog.json"), JSON.stringify(catalog) + "\n");
  await writeFile(
    path.join(DATA, "import-report.json"),
    JSON.stringify({ generatedAt, ...report, videoCheckFailures: videoFailures.length }, null, 2) + "\n",
  );
  log(`wrote ${catalog.recipes.length} recipes, ${catalog.ingredients.length} ingredients`);
  log(`flags: ${JSON.stringify(report.flagCounts)}`);
}

main().catch((error) => {
  process.stderr.write(`[import] FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
