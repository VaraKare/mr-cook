import type { RecipeSummary } from "../types";
import { applyFilters, type DiscoveryFilters } from "./filters";
import type { IngredientGraph } from "./graph";
import { randomIndex, type Rng } from "./random";

/** A recipe can appear on the wheel only if it has a photo to show. */
export function isWheelEligible(recipe: RecipeSummary): boolean {
  return recipe.imageUrl !== null && recipe.req.length + recipe.opt.length >= 2;
}

export interface PickResult {
  recipe: RecipeSummary | null;
  /** Recipes matching the filters. */
  eligibleCount: number;
  /** True when every eligible recipe was recently served and one had to repeat. */
  repeated: boolean;
}

/**
 * Choose one recipe uniformly at random from the eligible set, skipping
 * recently served ones while alternatives exist.
 *
 * `recentIds` is ordered newest first. If every eligible recipe is recent,
 * the one served longest ago is reused, so the user cycles through the whole
 * pool instead of seeing the same few dishes.
 *
 * Cost is O(n) over the in-memory index, which is fine for thousands of
 * records. The Supabase migration documents the indexed strategy for larger
 * catalogues (see supabase/migrations).
 */
export function pickRecipe(
  recipes: RecipeSummary[],
  options: { filters?: DiscoveryFilters; recentIds?: string[]; rng: Rng; graph: IngredientGraph },
): PickResult {
  const eligible = applyFilters(recipes.filter(isWheelEligible), options.filters ?? {}, options.graph);
  if (eligible.length === 0) return { recipe: null, eligibleCount: 0, repeated: false };

  const recent = options.recentIds ?? [];
  const recentSet = new Set(recent);
  const fresh = eligible.filter((r) => !recentSet.has(r.id));
  if (fresh.length > 0) {
    return { recipe: fresh[randomIndex(fresh.length, options.rng)], eligibleCount: eligible.length, repeated: false };
  }

  // Everything eligible was served recently: reuse the oldest one.
  const position = new Map(recent.map((id, i) => [id, i]));
  const oldest = eligible.reduce((best, r) => ((position.get(r.id) ?? -1) > (position.get(best.id) ?? -1) ? r : best));
  return { recipe: oldest, eligibleCount: eligible.length, repeated: true };
}

/** Push an id onto a newest-first history, de-duplicated and capped. */
export function rememberRecent(recentIds: string[], id: string, cap = 40): string[] {
  return [id, ...recentIds.filter((x) => x !== id)].slice(0, cap);
}
