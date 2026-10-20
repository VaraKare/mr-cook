import type { Ingredient } from "../types";

export interface IngredientGraph {
  parentOf: Map<string, string>;
  childrenOf: Map<string, string[]>;
}

export function buildGraph(ingredients: Pick<Ingredient, "id" | "parentId">[]): IngredientGraph {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const ing of ingredients) {
    if (!ing.parentId) continue;
    parentOf.set(ing.id, ing.parentId);
    childrenOf.set(ing.parentId, [...(childrenOf.get(ing.parentId) ?? []), ing.id]);
  }
  return { parentOf, childrenOf };
}

/**
 * Ingredient ids that a selected ingredient can stand in for: itself, its
 * family ("chicken thighs" -> "chicken") and its members ("chicken" ->
 * "chicken thighs"). Siblings ("chicken thighs" vs "chicken breast") are not
 * interchangeable.
 */
export function satisfiedBy(id: string, graph: IngredientGraph): string[] {
  const out = [id];
  const parent = graph.parentOf.get(id);
  if (parent) out.push(parent);
  out.push(...(graph.childrenOf.get(id) ?? []));
  return out;
}

export function expandHave(ids: Iterable<string>, graph: IngredientGraph): Set<string> {
  const set = new Set<string>();
  for (const id of ids) for (const s of satisfiedBy(id, graph)) set.add(s);
  return set;
}

/** Excluding a family excludes its members; excluding a member does not exclude the family. */
export function expandExcluded(ids: Iterable<string>, graph: IngredientGraph): Set<string> {
  const set = new Set<string>();
  for (const id of ids) {
    set.add(id);
    for (const child of graph.childrenOf.get(id) ?? []) set.add(child);
  }
  return set;
}
