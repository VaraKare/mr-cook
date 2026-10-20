import { cleanName } from "../ingest/normalize";
import type { Ingredient } from "../types";

/**
 * Ingredient search over canonical names and aliases. Exact matches first,
 * then prefix, word-prefix and substring matches; ties go to the ingredient
 * used by more recipes.
 */
export function searchIngredients(
  query: string,
  ingredients: Ingredient[],
  aliases: Record<string, string>,
  limit = 8,
): Ingredient[] {
  const q = cleanName(query);
  if (!q) return [];
  const variants = new Set([q]);
  if (q.endsWith("es")) variants.add(q.slice(0, -2));
  if (q.endsWith("s")) variants.add(q.slice(0, -1));
  else variants.add(`${q}s`);

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const best = new Map<string, number>();
  const consider = (id: string, rank: number) => {
    if (!byId.has(id) || byId.get(id)!.recipeCount === 0) return;
    best.set(id, Math.min(best.get(id) ?? Infinity, rank));
  };

  for (const v of variants) {
    const aliasHit = aliases[v];
    if (aliasHit) consider(aliasHit, 1);
  }
  for (const ing of ingredients) {
    const name = cleanName(ing.name);
    if (variants.has(name)) consider(ing.id, 0);
    else if (name.startsWith(q)) consider(ing.id, 2);
    else if (name.split(" ").some((w) => w.startsWith(q))) consider(ing.id, 3);
    else if (q.length >= 3 && name.includes(q)) consider(ing.id, 4);
  }
  for (const [alias, id] of Object.entries(aliases)) {
    if (alias !== q && q.length >= 3 && alias.startsWith(q)) consider(id, 5);
  }

  return [...best.entries()]
    .sort(([a, ra], [b, rb]) => ra - rb || byId.get(b)!.recipeCount - byId.get(a)!.recipeCount || a.localeCompare(b))
    .slice(0, limit)
    .map(([id]) => byId.get(id)!);
}
