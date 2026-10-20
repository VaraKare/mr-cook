import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/discovery/graph";
import { seededRng, sample } from "@/lib/discovery/random";
import { pickRecipe, rememberRecent } from "@/lib/discovery/selection";
import { initialWheel, placeOnWheel, sliceUnderPointer, targetRotation } from "@/lib/discovery/wheel";
import { ingredient, summary } from "./helpers";

const graph = buildGraph([ingredient("chicken"), ingredient("chicken-thighs", "chicken"), ingredient("peanuts")]);
const pool = Array.from({ length: 50 }, (_, i) =>
  summary(`r${i}`, i % 2 ? ["chicken-thighs", "salt"] : ["rice", "salt"], { meatFree: i % 2 === 0, category: i % 5 === 0 ? "Dessert" : "Main" }),
);

describe("pickRecipe", () => {
  it("returns null for an empty eligible set", () => {
    const res = pickRecipe(pool, { rng: seededRng(1), graph, filters: { categories: ["Nope"] } });
    expect(res).toEqual({ recipe: null, eligibleCount: 0, repeated: false });
  });

  it("only picks recipes that pass the filters", () => {
    const rng = seededRng(2);
    for (let i = 0; i < 200; i++) {
      const res = pickRecipe(pool, { rng, graph, filters: { meatFree: true, categories: ["Main"] } });
      expect(res.recipe!.meatFree).toBe(true);
      expect(res.recipe!.category).toBe("Main");
    }
  });

  it("excluding a family excludes its members", () => {
    const rng = seededRng(3);
    for (let i = 0; i < 100; i++) {
      const res = pickRecipe(pool, { rng, graph, filters: { excludedIngredientIds: ["chicken"] } });
      expect(res.recipe!.req).not.toContain("chicken-thighs");
    }
  });

  it("skips ineligible recipes without photos", () => {
    const rs = [summary("a", ["x", "y"], { imageUrl: null }), summary("b", ["x", "y"])];
    expect(pickRecipe(rs, { rng: seededRng(4), graph }).recipe!.id).toBe("b");
  });

  it("never repeats while fresh recipes remain, then cycles oldest-first", () => {
    const rng = seededRng(5);
    const small = pool.slice(0, 10);
    let recent: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const res = pickRecipe(small, { rng, graph, recentIds: recent });
      expect(seen.has(res.recipe!.id)).toBe(false);
      expect(res.repeated).toBe(false);
      seen.add(res.recipe!.id);
      recent = rememberRecent(recent, res.recipe!.id);
    }
    const again = pickRecipe(small, { rng, graph, recentIds: recent });
    expect(again.repeated).toBe(true);
    expect(again.recipe!.id).toBe(recent[recent.length - 1]);
  });

  it("is close to uniform over many spins", () => {
    const rng = seededRng(6);
    const counts = new Map<string, number>();
    const spins = 50_000;
    for (let i = 0; i < spins; i++) {
      const id = pickRecipe(pool, { rng, graph }).recipe!.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.size).toBe(pool.length);
    const expected = spins / pool.length;
    for (const c of counts.values()) expect(Math.abs(c - expected) / expected).toBeLessThan(0.15);
  });
});

describe("rememberRecent", () => {
  it("dedupes, orders newest first and caps", () => {
    expect(rememberRecent(["b", "a"], "a")).toEqual(["a", "b"]);
    expect(rememberRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });
});

describe("wheel geometry", () => {
  it("always lands the chosen slice under the pointer", () => {
    const rng = seededRng(7);
    for (const size of [6, 8, 10, 12]) {
      let rotation = 0;
      for (let i = 0; i < 500; i++) {
        const target = Math.floor(rng() * size);
        const next = targetRotation(rotation, target, size, 5, rng() * 2 - 1);
        expect(next - rotation).toBeGreaterThanOrEqual(5 * 360);
        expect(next - rotation).toBeLessThan(6 * 360);
        expect(sliceUnderPointer(next, size)).toBe(target);
        rotation = next;
      }
    }
  });

  it("places the chosen recipe on the wheel and targets its slice", () => {
    const rng = seededRng(8);
    let slices = initialWheel(pool, 10, rng);
    let rotation = 0;
    for (let i = 0; i < 200; i++) {
      const chosen = sample(pool, 1, rng)[0];
      const placed = placeOnWheel(chosen, slices, pool, 10, rotation, rng);
      expect(placed.slices).toHaveLength(10);
      expect(placed.slices[placed.targetIndex].id).toBe(chosen.id);
      rotation = targetRotation(rotation, placed.targetIndex, 10, 5, 0.3);
      expect(placed.slices[sliceUnderPointer(rotation, 10)].id).toBe(chosen.id);
      slices = placed.slices;
    }
  });

  it("replaces the slice opposite the pointer, not the visible one", () => {
    const rng = seededRng(9);
    const slices = pool.slice(0, 10);
    const outsider = pool[40];
    const placed = placeOnWheel(outsider, slices, pool, 10, 0, rng);
    expect(placed.targetIndex).toBe(5);
    expect(placed.slices.filter((s, i) => s !== slices[i])).toHaveLength(1);
  });

  it("fills the wheel even when the pool is tiny", () => {
    const tiny = pool.slice(0, 3);
    const placed = placeOnWheel(tiny[0], [], tiny, 10, 0, seededRng(10));
    expect(placed.slices).toHaveLength(10);
    expect(placed.slices[placed.targetIndex].id).toBe(tiny[0].id);
  });
});
