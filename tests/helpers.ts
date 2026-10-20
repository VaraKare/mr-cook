import type { Ingredient, RecipeSummary } from "@/lib/types";

export function summary(id: string, req: string[], extra: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id,
    slug: id,
    title: id,
    imageUrl: `https://img/${id}.jpg`,
    country: "Italy",
    cuisine: "Italian",
    category: "Chicken",
    totalMinutes: null,
    req,
    opt: [],
    meatFree: true,
    hasVideo: false,
    ...extra,
  };
}

export function ingredient(id: string, parentId: string | null = null): Ingredient {
  return { id, name: id.replace(/-/g, " "), type: null, animal: null, iconUrl: null, parentId, recipeCount: 1 };
}
