/**
 * Build-time catalogue access for Server Components. Reads the committed
 * data/catalog.json once; nothing here ships to the browser.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { toSummary } from "./catalog-shared";
import type { Catalog, Ingredient, Recipe, RecipeSummary } from "./types";

let cached: Catalog | null = null;

export function getCatalog(): Catalog {
  if (!cached) {
    cached = JSON.parse(readFileSync(path.join(process.cwd(), "data/catalog.json"), "utf8")) as Catalog;
  }
  return cached;
}

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return getCatalog().recipes.find((r) => r.slug === slug);
}

export function getRelated(recipe: Recipe, count = 4): RecipeSummary[] {
  const all = getCatalog().recipes.filter((r) => r.id !== recipe.id && r.imageUrl);
  const sameCountry = all.filter((r) => recipe.country && r.country === recipe.country);
  const sameCategory = all.filter((r) => r.category === recipe.category && !sameCountry.includes(r));
  // Deterministic pick so static builds are stable.
  const seed = Number(recipe.source.recipeId) || 0;
  const rotate = <T,>(xs: T[]) => (xs.length ? [...xs.slice(seed % xs.length), ...xs.slice(0, seed % xs.length)] : xs);
  return [...rotate(sameCountry), ...rotate(sameCategory)].slice(0, count).map(toSummary);
}

export function getStats() {
  const { recipes, ingredients } = getCatalog();
  return {
    recipes: recipes.length,
    countries: new Set(recipes.map((r) => r.country).filter(Boolean)).size,
    ingredients: ingredients.filter((i) => i.recipeCount > 0).length,
    withVideo: recipes.filter((r) => r.videos.some((v) => v.status === "ok")).length,
  };
}

export function getPopularIngredients(count: number, exclude: string[] = []): Ingredient[] {
  const skip = new Set(exclude);
  return getCatalog()
    .ingredients.filter((i) => !skip.has(i.id) && i.recipeCount > 0)
    .sort((a, b) => b.recipeCount - a.recipeCount)
    .slice(0, count);
}
