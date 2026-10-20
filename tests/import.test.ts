import { describe, expect, it } from "vitest";
import { mapMealDb } from "@/lib/ingest/themealdb";
import { toDiscoveryIndex } from "@/lib/catalog-shared";
import { fixtureIngredients, fixtureMeals } from "./fixtures/mealdb";

const run = () =>
  mapMealDb(
    fixtureMeals,
    fixtureIngredients,
    { abcdefghijk: { status: "ok", title: "How to cook", channelTitle: "A Channel", checkedAt: "2026-01-01T00:00:00Z" } },
    "2026-01-01T00:00:00Z",
  );

describe("mapMealDb", () => {
  it("deduplicates by source id and skips invalid records", () => {
    const { catalog, report } = run();
    expect(catalog.recipes.map((r) => r.id)).toEqual(["mealdb-1", "mealdb-2", "mealdb-3"]);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.skipped).toHaveLength(1);
  });

  it("is deterministic (safe to re-run)", () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("preserves source attribution and never invents unknown fields", () => {
    const r = run().catalog.recipes[0];
    expect(r.source).toMatchObject({ name: "TheMealDB", recipeId: "1", originalUrl: "https://example.org/recipe" });
    expect(r.source.attribution).toContain("TheMealDB");
    expect(r.prepMinutes).toBeNull();
    expect(r.cookMinutes).toBeNull();
    expect(r.totalMinutes).toBeNull();
    expect(r.servings).toBeNull();
    expect(r.difficulty).toBeNull();
    expect(r.isVerified).toBe(false);
    expect(r.flags).toContain("missing-times");
  });

  it("normalises ingredient names and keeps the source text", () => {
    const r = run().catalog.recipes[0];
    const ids = r.ingredients.map((i) => i.ingredientId);
    expect(ids).toEqual(["chicken-thighs", "garlic", "onion", "salt", "parsley"]);
    expect(r.ingredients[1]).toMatchObject({ sourceName: "Garlic Clove", measure: "3 cloves", quantity: 3, unit: "clove" });
    expect(r.ingredients[4].isOptional).toBe(true);
  });

  it("links aliases and families", () => {
    const { catalog } = run();
    expect(catalog.aliases["cilantro"]).toBe("coriander");
    expect(catalog.aliases["scallions"]).toBe("spring-onion");
    const thighs = catalog.ingredients.find((i) => i.id === "chicken-thighs")!;
    expect(thighs.parentId).toBe("chicken");
    expect(thighs.animal).toBe("meat");
  });

  it("derives meat-free from ingredients, not the category label", () => {
    const [, rice, stirFry] = run().catalog.recipes;
    expect(rice.meatFree).toBe(true);
    expect(stirFry.category).toBe("Vegetarian");
    expect(stirFry.meatFree).toBe(false);
  });

  it("flags missing data and keeps video metadata from checks only", () => {
    const [chicken, rice, stirFry] = run().catalog.recipes;
    expect(chicken.videos[0]).toMatchObject({ youtubeId: "abcdefghijk", title: "How to cook", origin: "source", status: "ok" });
    expect(rice.videos).toEqual([]);
    expect(rice.flags).toContain("no-video");
    expect(stirFry.flags).toEqual(expect.arrayContaining(["missing-image", "missing-country"]));
    expect(stirFry.imageUrl).toBeNull();
    expect(stirFry.country).toBeNull();
  });

  it("builds a discovery index with required and optional ids", () => {
    const index = toDiscoveryIndex(run().catalog);
    const chicken = index.recipes[0];
    expect(chicken.req).toEqual(["chicken-thighs", "garlic", "onion", "salt"]);
    expect(chicken.opt).toEqual(["parsley"]);
  });
});
