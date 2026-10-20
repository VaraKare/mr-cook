import type { RecipeSummary } from "../types";
import { applyFilters, type DiscoveryFilters } from "./filters";
import { expandHave, satisfiedBy, type IngredientGraph } from "./graph";

/** Basics most kitchens have. Only assumed when the user leaves the toggle on. */
export const PANTRY_STAPLES = ["salt", "pepper", "black-pepper", "water", "oil", "vegetable-oil", "olive-oil", "sunflower-oil"];

export type MatchMode = "have" | "buy";

export interface MatchOptions {
  mode: MatchMode;
  /** Required ingredients allowed to be missing in "buy" mode (1–5). */
  maxMissing: number;
  assumePantry: boolean;
  filters?: DiscoveryFilters;
  limit?: number;
}

export interface MatchResult {
  recipe: RecipeSummary;
  /** Recipe ingredient ids covered by the user's selection. */
  have: string[];
  /** Recipe ingredient ids covered only by assumed pantry staples. */
  pantry: string[];
  missingRequired: string[];
  missingOptional: string[];
  /** How many of the user's selected ingredients this recipe uses. */
  selectedUsed: number;
  /** selectedUsed / number selected, 0–1. */
  selectedUsedShare: number;
  /** All required ingredients are covered. */
  cookable: boolean;
}

export interface MatchResponse {
  results: MatchResult[];
  /** In "have" mode: close candidates missing 1–2 required ingredients. */
  nearMisses: MatchResult[];
  totalMatches: number;
}

export function scoreRecipe(
  recipe: RecipeSummary,
  selectedIds: string[],
  haveSet: Set<string>,
  pantrySet: Set<string>,
  graph: IngredientGraph,
): MatchResult {
  const have: string[] = [];
  const pantry: string[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  for (const id of recipe.req) {
    if (haveSet.has(id)) have.push(id);
    else if (pantrySet.has(id)) pantry.push(id);
    else missingRequired.push(id);
  }
  for (const id of recipe.opt) {
    if (haveSet.has(id)) have.push(id);
    else if (pantrySet.has(id)) pantry.push(id);
    else missingOptional.push(id);
  }
  const uses = new Set([...recipe.req, ...recipe.opt]);
  const selectedUsed = selectedIds.filter((s) => satisfiedBy(s, graph).some((x) => uses.has(x))).length;
  return {
    recipe,
    have,
    pantry,
    missingRequired,
    missingOptional,
    selectedUsed,
    selectedUsedShare: selectedIds.length ? selectedUsed / selectedIds.length : 0,
    cookable: missingRequired.length === 0,
  };
}

/**
 * Ranking (documented in docs/ARCHITECTURE.md):
 *
 * "have" mode — only recipes with every required ingredient covered.
 *   1. more of your selected ingredients used
 *   2. fewer optional ingredients missing
 *   3. title (stable order)
 *
 * "buy" mode — up to `maxMissing` required ingredients may be missing.
 *   1. net = selected used − required missing (each extra thing you use
 *      offsets one thing you would have to buy)
 *   2. fewer required missing
 *   3. more selected used
 *   4. fewer optional missing
 *   5. title
 */
export function compareHave(a: MatchResult, b: MatchResult): number {
  return (
    b.selectedUsed - a.selectedUsed ||
    a.missingOptional.length - b.missingOptional.length ||
    a.recipe.title.localeCompare(b.recipe.title)
  );
}

export function compareBuy(a: MatchResult, b: MatchResult): number {
  const netA = a.selectedUsed - a.missingRequired.length;
  const netB = b.selectedUsed - b.missingRequired.length;
  return (
    netB - netA ||
    a.missingRequired.length - b.missingRequired.length ||
    b.selectedUsed - a.selectedUsed ||
    a.missingOptional.length - b.missingOptional.length ||
    a.recipe.title.localeCompare(b.recipe.title)
  );
}

export function matchRecipes(
  recipes: RecipeSummary[],
  selectedIds: string[],
  options: MatchOptions,
  graph: IngredientGraph,
): MatchResponse {
  const selected = [...new Set(selectedIds)];
  if (selected.length === 0) return { results: [], nearMisses: [], totalMatches: 0 };

  const haveSet = expandHave(selected, graph);
  const pantrySet = options.assumePantry ? expandHave(PANTRY_STAPLES, graph) : new Set<string>();
  const maxMissing = Math.max(1, Math.min(5, Math.round(options.maxMissing)));
  const limit = options.limit ?? 60;

  const scored = applyFilters(recipes, options.filters ?? {}, graph)
    .map((r) => scoreRecipe(r, selected, haveSet, pantrySet, graph))
    .filter((m) => m.selectedUsed > 0);

  if (options.mode === "have") {
    const results = scored.filter((m) => m.cookable).sort(compareHave);
    const nearMisses =
      results.length < 6
        ? scored.filter((m) => m.missingRequired.length >= 1 && m.missingRequired.length <= 2).sort(compareBuy).slice(0, 6)
        : [];
    return { results: results.slice(0, limit), nearMisses, totalMatches: results.length };
  }

  const results = scored.filter((m) => m.missingRequired.length <= maxMissing).sort(compareBuy);
  return { results: results.slice(0, limit), nearMisses: [], totalMatches: results.length };
}
