import type { Catalog, Ingredient, QualityFlag, Recipe, RecipeIngredient, RecipeVideo } from "../types";
import {
  ALIASES,
  animalClass,
  canonicalName,
  cleanName,
  familyOf,
  parseMeasure,
  slugify,
  splitInstructions,
  titleCase,
  youtubeIdFromUrl,
} from "./normalize";

/** Raw meal record as returned by TheMealDB `search.php`. */
export type MealDbMeal = Record<string, string | null> & { idMeal: string; strMeal: string };

export interface MealDbIngredient {
  idIngredient: string;
  strIngredient: string;
  strDescription: string | null;
  strThumb?: string | null;
  strType: string | null;
}

export interface VideoCheck {
  status: "ok" | "unavailable";
  title: string | null;
  channelTitle: string | null;
  checkedAt: string;
}

export interface ImportReport {
  source: string;
  fetchedRecords: number;
  imported: number;
  skipped: { id: string | null; reason: string }[];
  duplicatesRemoved: number;
  ingredients: number;
  aliases: number;
  flagCounts: Partial<Record<QualityFlag, number>>;
  withVideo: number;
  withOriginalSource: number;
  withCountry: number;
}

export const MEALDB_SOURCE = {
  name: "TheMealDB",
  url: "https://www.themealdb.com/",
  terms: "https://www.themealdb.com/terms_of_use.php",
  attribution: "Recipe data and imagery: TheMealDB (https://www.themealdb.com/)",
};

const LICENCE_NOTE =
  "TheMealDB API content; see https://www.themealdb.com/terms_of_use.php. Images are user-contributed artwork hosted by TheMealDB.";

function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function httpUrl(value: string | null | undefined): string | null {
  const v = text(value);
  if (!v) return null;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function ingredientIcon(meta: MealDbIngredient | undefined, sourceName: string): string {
  if (meta?.strThumb) return meta.strThumb.replace(/\.png$/, "-small.png");
  return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(sourceName)}-small.png`;
}

/**
 * Map raw TheMealDB records into the unified catalogue. Pure and
 * deterministic for a given input so it can be unit-tested and re-run safely.
 */
export function mapMealDb(
  meals: MealDbMeal[],
  ingredientList: MealDbIngredient[],
  videoChecks: Record<string, VideoCheck>,
  generatedAt: string,
): { catalog: Catalog; report: ImportReport } {
  const skipped: ImportReport["skipped"] = [];

  // 1. Deduplicate by source id (the letter-search endpoint can overlap).
  const byId = new Map<string, MealDbMeal>();
  for (const meal of meals) {
    if (!meal || !text(meal.idMeal) || !text(meal.strMeal)) {
      skipped.push({ id: meal?.idMeal ?? null, reason: "missing id or title" });
      continue;
    }
    if (!byId.has(meal.idMeal)) byId.set(meal.idMeal, meal);
  }
  const duplicatesRemoved = meals.length - skipped.length - byId.size;
  const unique = [...byId.values()].sort((a, b) => Number(a.idMeal) - Number(b.idMeal));

  // 2. Build the ingredient vocabulary so plurals collapse onto real names.
  const metaByClean = new Map<string, MealDbIngredient>();
  for (const ing of ingredientList) metaByClean.set(cleanName(ing.strIngredient), ing);

  const rawPairs = (meal: MealDbMeal) => {
    const pairs: { name: string; measure: string | null }[] = [];
    for (let i = 1; i <= 20; i++) {
      const name = text(meal[`strIngredient${i}`]);
      if (name) pairs.push({ name, measure: text(meal[`strMeasure${i}`]) });
    }
    return pairs;
  };

  const vocabulary = new Set<string>(metaByClean.keys());
  for (const meal of unique) for (const p of rawPairs(meal)) vocabulary.add(cleanName(p.name));
  for (const target of Object.values(ALIASES)) vocabulary.add(target);

  // 3. Canonical ingredient records.
  const ingredients = new Map<string, Ingredient & { clean: string }>();
  const aliases: Record<string, string> = {};
  const ensureIngredient = (rawName: string): Ingredient & { clean: string } => {
    const canonical = canonicalName(rawName, vocabulary);
    const id = slugify(canonical);
    let record = ingredients.get(id);
    if (!record) {
      const meta = metaByClean.get(canonical) ?? metaByClean.get(cleanName(rawName));
      record = {
        id,
        clean: canonical,
        name: meta && cleanName(meta.strIngredient) === canonical ? meta.strIngredient.trim() : titleCase(canonical),
        type: meta?.strType ?? null,
        animal: null,
        iconUrl: ingredientIcon(meta, meta?.strIngredient ?? rawName),
        parentId: null,
        recipeCount: 0,
      };
      record.animal = animalClass(canonical, record.type);
      ingredients.set(id, record);
    }
    aliases[cleanName(rawName)] = id;
    return record;
  };

  // 4. Recipes.
  const recipes: Recipe[] = [];
  const slugCounts = new Map<string, number>();
  for (const meal of unique) {
    const title = text(meal.strMeal)!;
    const recipeIngredients: RecipeIngredient[] = [];
    const seen = new Set<string>();
    for (const pair of rawPairs(meal)) {
      const ing = ensureIngredient(pair.name);
      const parsed = parseMeasure(pair.measure);
      if (seen.has(ing.id)) {
        // Same ingredient listed twice (e.g. butter for sauce and topping):
        // keep both measures visible but count the ingredient once.
        const existing = recipeIngredients.find((r) => r.ingredientId === ing.id)!;
        existing.measure = [existing.measure, pair.measure].filter(Boolean).join(" + ") || null;
        existing.quantity = null;
        existing.unit = null;
        existing.isOptional = existing.isOptional && parsed.isOptional;
        continue;
      }
      seen.add(ing.id);
      recipeIngredients.push({
        ingredientId: ing.id,
        sourceName: pair.name,
        measure: pair.measure,
        quantity: parsed.quantity,
        unit: parsed.unit,
        isOptional: parsed.isOptional,
      });
    }

    const videos: RecipeVideo[] = [];
    const ytId = youtubeIdFromUrl(meal.strYoutube);
    if (ytId) {
      const check = videoChecks[ytId];
      videos.push({
        youtubeId: ytId,
        title: check?.title ?? null,
        channelTitle: check?.channelTitle ?? null,
        url: `https://www.youtube.com/watch?v=${ytId}`,
        origin: "source",
        status: check?.status ?? "unchecked",
        lastCheckedAt: check?.checkedAt ?? null,
      });
    }

    const instructions = splitInstructions(meal.strInstructions);
    const imageUrl = httpUrl(meal.strMealThumb);
    const country = text(meal.strCountry);
    const flags: QualityFlag[] = ["missing-times"];
    if (!imageUrl) flags.push("missing-image");
    if (instructions.length === 0) flags.push("missing-instructions");
    if (recipeIngredients.length < 2) flags.push("few-ingredients");
    if (!country) flags.push("missing-country");
    if (recipeIngredients.some((r) => !r.measure)) flags.push("missing-measure");
    if (videos.length === 0) flags.push("no-video");
    if (videos.some((v) => v.status === "unavailable")) flags.push("video-unavailable");

    let slug = slugify(title) || `recipe-${meal.idMeal}`;
    const count = slugCounts.get(slug) ?? 0;
    slugCounts.set(slug, count + 1);
    if (count > 0) {
      slug = `${slug}-${meal.idMeal}`;
      flags.push("duplicate-title");
    }

    recipes.push({
      id: `mealdb-${meal.idMeal}`,
      slug,
      title,
      alternateTitle: text(meal.strMealAlternate),
      description: null,
      country,
      // TheMealDB "area" is a cuisine label (e.g. "Italian"), not a country.
      cuisine: text(meal.strArea),
      category: text(meal.strCategory),
      tags: (text(meal.strTags) ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      servings: null,
      difficulty: null,
      instructions,
      imageUrl,
      source: {
        name: MEALDB_SOURCE.name,
        recipeId: meal.idMeal,
        providerUrl: `https://www.themealdb.com/meal/${meal.idMeal}`,
        originalUrl: httpUrl(meal.strSource),
        licence: LICENCE_NOTE,
        attribution: MEALDB_SOURCE.attribution,
      },
      ingredients: recipeIngredients,
      videos,
      meatFree: recipeIngredients.every((r) => ingredients.get(r.ingredientId)!.animal === null),
      isVerified: false,
      flags,
      sourceUpdatedAt: text(meal.dateModified),
    });
  }

  // 5. Families and usage counts.
  const idsByClean = new Map([...ingredients.values()].map((i) => [i.clean, i.id]));
  for (const ing of ingredients.values()) {
    const family = familyOf(ing.clean, new Set(idsByClean.keys()));
    ing.parentId = family ? idsByClean.get(family)! : null;
  }
  for (const recipe of recipes) for (const ri of recipe.ingredients) ingredients.get(ri.ingredientId)!.recipeCount++;
  for (const [alias, target] of Object.entries(ALIASES)) {
    const id = idsByClean.get(target);
    if (id) aliases[alias] = id;
  }

  const ingredientList2: Ingredient[] = [...ingredients.values()]
    .map((i) => ({ id: i.id, name: i.name, type: i.type, animal: i.animal, iconUrl: i.iconUrl, parentId: i.parentId, recipeCount: i.recipeCount }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const flagCounts: ImportReport["flagCounts"] = {};
  for (const r of recipes) for (const f of r.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;

  const sortedAliases = Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)));

  return {
    catalog: {
      schemaVersion: 1,
      generatedAt,
      sources: [MEALDB_SOURCE],
      recipes,
      ingredients: ingredientList2,
      aliases: sortedAliases,
    },
    report: {
      source: MEALDB_SOURCE.name,
      fetchedRecords: meals.length,
      imported: recipes.length,
      skipped,
      duplicatesRemoved,
      ingredients: ingredientList2.length,
      aliases: Object.keys(sortedAliases).length,
      flagCounts,
      withVideo: recipes.filter((r) => r.videos.length > 0).length,
      withOriginalSource: recipes.filter((r) => r.source.originalUrl).length,
      withCountry: recipes.filter((r) => r.country).length,
    },
  };
}
