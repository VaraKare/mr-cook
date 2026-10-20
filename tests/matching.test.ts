import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/discovery/graph";
import { matchRecipes } from "@/lib/discovery/matching";
import { searchIngredients } from "@/lib/discovery/search";
import { ingredient, summary } from "./helpers";

const ingredients = [
  ingredient("chicken"),
  ingredient("chicken-thighs", "chicken"),
  ingredient("chicken-breast", "chicken"),
  ingredient("rice"),
  ingredient("garlic"),
  ingredient("onion"),
  ingredient("egg"),
  ingredient("salt"),
  ingredient("soy-sauce"),
  ingredient("ginger"),
  ingredient("parsley"),
];
const graph = buildGraph(ingredients);

const recipes = [
  summary("garlic-chicken", ["chicken-thighs", "garlic", "salt"], { opt: ["parsley"], meatFree: false }),
  summary("fried-rice", ["rice", "egg", "onion", "soy-sauce", "salt"]),
  summary("plain-rice", ["rice", "salt"]),
  summary("chicken-rice", ["chicken", "rice", "garlic", "onion", "ginger", "soy-sauce"], { meatFree: false }),
  summary("breast-only", ["chicken-breast"], { meatFree: false }),
  summary("unrelated", ["ginger", "soy-sauce"]),
];

describe("matchRecipes — use what I have", () => {
  const selected = ["chicken", "rice", "garlic", "onion", "egg"];

  it("returns only fully covered recipes, with pantry staples assumed", () => {
    const { results } = matchRecipes(recipes, selected, { mode: "have", maxMissing: 2, assumePantry: true }, graph);
    for (const r of results) {
      expect(r.cookable).toBe(true);
      expect(r.missingRequired).toEqual([]);
    }
    const ids = results.map((r) => r.recipe.id);
    expect(ids).toContain("garlic-chicken");
    expect(ids).toContain("plain-rice");
    expect(ids).not.toContain("fried-rice");
    expect(ids).not.toContain("unrelated");
  });

  it("ranks recipes that use more of the selection first", () => {
    const { results } = matchRecipes(recipes, selected, { mode: "have", maxMissing: 2, assumePantry: true }, graph);
    expect(results[0].recipe.id).toBe("garlic-chicken");
    expect(results[0].selectedUsed).toBe(2);
    expect(results[0].selectedUsedShare).toBeCloseTo(0.4);
  });

  it("separates have / pantry / missing optional", () => {
    const { results } = matchRecipes(recipes, selected, { mode: "have", maxMissing: 2, assumePantry: true }, graph);
    const gc = results.find((r) => r.recipe.id === "garlic-chicken")!;
    expect(gc.have).toEqual(["chicken-thighs", "garlic"]);
    expect(gc.pantry).toEqual(["salt"]);
    expect(gc.missingOptional).toEqual(["parsley"]);
  });

  it("does not assume pantry staples when the toggle is off", () => {
    const { results } = matchRecipes(recipes, selected, { mode: "have", maxMissing: 2, assumePantry: false }, graph);
    expect(results.map((r) => r.recipe.id)).toEqual(["breast-only"]);
  });

  it("family selection covers specific cuts but siblings do not cover each other", () => {
    const thighsOnly = matchRecipes(recipes, ["chicken-thighs"], { mode: "have", maxMissing: 1, assumePantry: false }, graph);
    expect(thighsOnly.results.map((r) => r.recipe.id)).not.toContain("breast-only");
    const generic = matchRecipes(recipes, ["chicken"], { mode: "have", maxMissing: 1, assumePantry: false }, graph);
    expect(generic.results.map((r) => r.recipe.id)).toContain("breast-only");
  });

  it("offers near misses when few recipes are fully covered", () => {
    const { nearMisses } = matchRecipes(recipes, selected, { mode: "have", maxMissing: 2, assumePantry: true }, graph);
    expect(nearMisses.map((r) => r.recipe.id)).toContain("fried-rice");
    for (const n of nearMisses) expect(n.cookable).toBe(false);
  });
});

describe("matchRecipes — I can buy a few more things", () => {
  const selected = ["chicken", "rice", "garlic", "onion", "egg"];

  it("respects the missing-ingredient allowance", () => {
    const one = matchRecipes(recipes, selected, { mode: "buy", maxMissing: 1, assumePantry: true }, graph);
    for (const r of one.results) expect(r.missingRequired.length).toBeLessThanOrEqual(1);
    expect(one.results.map((r) => r.recipe.id)).toContain("fried-rice");
    expect(one.results.map((r) => r.recipe.id)).not.toContain("chicken-rice");
    const two = matchRecipes(recipes, selected, { mode: "buy", maxMissing: 2, assumePantry: true }, graph);
    expect(two.results.map((r) => r.recipe.id)).toContain("chicken-rice");
  });

  it("ranks by net ingredients used minus missing", () => {
    const { results } = matchRecipes(recipes, selected, { mode: "buy", maxMissing: 3, assumePantry: true }, graph);
    const net = results.map((r) => r.selectedUsed - r.missingRequired.length);
    expect([...net].sort((a, b) => b - a)).toEqual(net);
    // Ties on net prefer fewer things to buy.
    expect(results[0].recipe.id).toBe("garlic-chicken");
    const ids = results.map((r) => r.recipe.id);
    expect(ids.indexOf("fried-rice")).toBeLessThan(ids.indexOf("chicken-rice"));
  });

  it("never reports a recipe with missing ingredients as cookable", () => {
    const { results } = matchRecipes(recipes, selected, { mode: "buy", maxMissing: 5, assumePantry: true }, graph);
    for (const r of results) expect(r.cookable).toBe(r.missingRequired.length === 0);
  });

  it("clamps the allowance and handles an empty selection", () => {
    const res = matchRecipes(recipes, selected, { mode: "buy", maxMissing: 99, assumePantry: true }, graph);
    for (const r of res.results) expect(r.missingRequired.length).toBeLessThanOrEqual(5);
    expect(matchRecipes(recipes, [], { mode: "buy", maxMissing: 2, assumePantry: true }, graph).results).toEqual([]);
  });

  it("applies filters", () => {
    const res = matchRecipes(recipes, selected, { mode: "buy", maxMissing: 3, assumePantry: true, filters: { meatFree: true } }, graph);
    for (const r of res.results) expect(r.recipe.meatFree).toBe(true);
  });
});

describe("searchIngredients", () => {
  const aliases = { cilantro: "parsley", scallion: "onion" };
  it("finds by name, prefix and alias", () => {
    expect(searchIngredients("rice", ingredients, aliases)[0].id).toBe("rice");
    expect(searchIngredients("chick", ingredients, aliases).map((i) => i.id)).toContain("chicken-thighs");
    expect(searchIngredients("Cilantro", ingredients, aliases)[0].id).toBe("parsley");
    expect(searchIngredients("eggs", ingredients, aliases)[0].id).toBe("egg");
    expect(searchIngredients("   ", ingredients, aliases)).toEqual([]);
  });
});
