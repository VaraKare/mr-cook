import type { RecipeSummary } from "../types";
import { expandExcluded, type IngredientGraph } from "./graph";

export interface DiscoveryFilters {
  /** Only recipes where no listed ingredient is meat or seafood. */
  meatFree?: boolean;
  /** Hide recipes that list any of these ingredients (or their family members). */
  excludedIngredientIds?: string[];
  categories?: string[];
  countries?: string[];
  /** Applied only to recipes with a known total time. */
  maxTotalMinutes?: number | null;
  /** When a time limit is set, keep recipes whose time is unknown. Default true. */
  includeUnknownTime?: boolean;
}

export function applyFilters(
  recipes: RecipeSummary[],
  filters: DiscoveryFilters,
  graph: IngredientGraph,
): RecipeSummary[] {
  const excluded = expandExcluded(filters.excludedIngredientIds ?? [], graph);
  const categories = filters.categories?.length ? new Set(filters.categories) : null;
  const countries = filters.countries?.length ? new Set(filters.countries) : null;
  const maxMinutes = filters.maxTotalMinutes ?? null;
  const includeUnknown = filters.includeUnknownTime ?? true;

  return recipes.filter((r) => {
    if (filters.meatFree && !r.meatFree) return false;
    if (categories && (!r.category || !categories.has(r.category))) return false;
    if (countries && (!r.country || !countries.has(r.country))) return false;
    if (maxMinutes !== null) {
      if (r.totalMinutes === null ? !includeUnknown : r.totalMinutes > maxMinutes) return false;
    }
    if (excluded.size > 0) {
      for (const id of r.req) if (excluded.has(id)) return false;
      for (const id of r.opt) if (excluded.has(id)) return false;
    }
    return true;
  });
}
