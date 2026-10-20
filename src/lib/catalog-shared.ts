import type { Catalog, DiscoveryIndex, Recipe, RecipeSummary } from "./types";

export function toSummary(recipe: Recipe): RecipeSummary {
  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    imageUrl: recipe.imageUrl,
    country: recipe.country,
    cuisine: recipe.cuisine,
    category: recipe.category,
    totalMinutes: recipe.totalMinutes,
    req: recipe.ingredients.filter((i) => !i.isOptional).map((i) => i.ingredientId),
    opt: recipe.ingredients.filter((i) => i.isOptional).map((i) => i.ingredientId),
    meatFree: recipe.meatFree,
    hasVideo: recipe.videos.some((v) => v.status !== "unavailable"),
  };
}

export function toDiscoveryIndex(catalog: Catalog): DiscoveryIndex {
  return {
    generatedAt: catalog.generatedAt,
    recipes: catalog.recipes.map(toSummary),
    ingredients: catalog.ingredients.filter((i) => i.recipeCount > 0),
    aliases: catalog.aliases,
  };
}
