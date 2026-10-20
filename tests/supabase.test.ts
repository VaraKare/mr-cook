/**
 * Runs the real Supabase migration on PGlite (Postgres compiled to WASM),
 * loads a slice of the real catalogue, and checks:
 *   - constraints and row-level security behave as intended
 *   - SQL random selection respects filters and recent history
 *   - SQL ingredient matching agrees with the TypeScript engine
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toDiscoveryIndex } from "@/lib/catalog-shared";
import { buildGraph } from "@/lib/discovery/graph";
import { matchRecipes } from "@/lib/discovery/matching";
import { catalogToSql } from "@/lib/ingest/sql";
import type { Catalog } from "@/lib/types";

const root = path.resolve(__dirname, "..");
const full = JSON.parse(readFileSync(path.join(root, "data/catalog.json"), "utf8")) as Catalog;

// A deterministic slice keeps the test fast while covering real data.
const recipes = full.recipes.filter((_, i) => i % 4 === 0);
const used = new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.ingredientId)));
for (const i of full.ingredients) if (used.has(i.id) && i.parentId) used.add(i.parentId);
const ingredients = full.ingredients.filter((i) => used.has(i.id) || full.ingredients.some((c) => c.parentId === i.id && used.has(c.id)));
const ids = new Set(ingredients.map((i) => i.id));
const catalog: Catalog = {
  ...full,
  recipes,
  ingredients: ingredients.map((i) => ({ ...i, parentId: i.parentId && ids.has(i.parentId) ? i.parentId : null })),
  aliases: Object.fromEntries(Object.entries(full.aliases).filter(([, id]) => ids.has(id))),
};

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;
// Supabase grants these by default; RLS then decides what is visible.
const SUPABASE_DEFAULT_GRANTS = `
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
`;

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const migration = readFileSync(path.join(root, "supabase/migrations/20261020000000_init.sql"), "utf8");
  // Default grants come first in a real project; replay the migration's revokes after them.
  const [schema] = migration.split("-- Belt and braces");
  await db.exec(schema);
  await db.exec(SUPABASE_DEFAULT_GRANTS);
  await db.exec("-- Belt and braces" + migration.split("-- Belt and braces")[1]);
  await db.exec(catalogToSql(catalog));
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("schema and seed", () => {
  it("loads every recipe and ingredient link", async () => {
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.recipes");
    expect(r.rows[0].n).toBe(recipes.length);
    const ri = await db.query<{ n: number }>("select count(*)::int as n from public.recipe_ingredients");
    expect(ri.rows[0].n).toBe(recipes.reduce((s, x) => s + x.ingredients.length, 0));
  });

  it("re-running the seed is idempotent", async () => {
    await db.exec(catalogToSql(catalog));
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.recipes");
    expect(r.rows[0].n).toBe(recipes.length);
  });

  it("rejects invalid data", async () => {
    await expect(db.exec("insert into public.recipe_videos (recipe_id, youtube_video_id, video_url, origin) select id, 'not-an-id', 'https://www.youtube.com/x', 'source' from public.recipes limit 1")).rejects.toThrow();
    await expect(db.exec("update public.recipes set servings = 0 where true")).rejects.toThrow();
  });
});

describe("row-level security", () => {
  const userA = "00000000-0000-0000-0000-00000000000a";
  const userB = "00000000-0000-0000-0000-00000000000b";

  async function as<T>(role: "anon" | "authenticated", sub: string | null, fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', ${sub ? `'${sub}'` : "''"}, false);`);
    try {
      return await fn();
    } finally {
      await db.exec("reset role;");
    }
  }

  beforeAll(async () => {
    await db.exec(`insert into auth.users values ('${userA}'), ('${userB}') on conflict do nothing;`);
  });

  it("lets anyone read the catalogue but not write it", async () => {
    const n = await as("anon", null, () => db.query<{ n: number }>("select count(*)::int as n from public.recipes"));
    expect(n.rows[0].n).toBe(recipes.length);
    await expect(as("anon", null, () => db.exec("delete from public.recipes"))).rejects.toThrow();
    await expect(as("authenticated", userA, () => db.exec("update public.recipes set title = 'x'"))).rejects.toThrow();
  });

  it("keeps saved recipes private to their owner", async () => {
    const recipeId = (await db.query<{ id: string }>("select id from public.recipes limit 1")).rows[0].id;
    await as("authenticated", userA, () => db.query("insert into public.saved_recipes (user_id, recipe_id) values ($1, $2)", [userA, recipeId]));
    await expect(
      as("authenticated", userA, () => db.query("insert into public.saved_recipes (user_id, recipe_id) values ($1, $2)", [userB, recipeId])),
    ).rejects.toThrow();
    const mine = await as("authenticated", userA, () => db.query("select * from public.saved_recipes"));
    const theirs = await as("authenticated", userB, () => db.query("select * from public.saved_recipes"));
    const anon = as("anon", null, () => db.query("select * from public.saved_recipes"));
    expect(mine.rows).toHaveLength(1);
    expect(theirs.rows).toHaveLength(0);
    await expect(anon).rejects.toThrow();
  });
});

describe("pick_random_recipe", () => {
  it("respects filters and handles an empty result", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await db.query<{ meat_free: boolean; category: string }>("select * from public.pick_random_recipe(p_meat_free => true, p_categories => array['Dessert'])");
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].meat_free).toBe(true);
      expect(r.rows[0].category).toBe("Dessert");
    }
    const none = await db.query("select * from public.pick_random_recipe(p_categories => array['No such category'])");
    expect(none.rows).toHaveLength(0);
  });

  it("excludes ingredient families", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await db.query<{ id: string }>("select id from public.pick_random_recipe(p_excluded => array['chicken'])");
      const hit = await db.query<{ n: number }>(
        "select count(*)::int as n from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id where ri.recipe_id = $1 and (i.id = 'chicken' or i.parent_id = 'chicken')",
        [r.rows[0].id],
      );
      expect(hit.rows[0].n).toBe(0);
    }
  });

  it("avoids recent recipes and falls back when all are recent", async () => {
    const pool = (await db.query<{ id: string }>("select id from public.recipes where category in ('Goat', 'Vegan') and image_url is not null")).rows.map((r) => r.id);
    expect(pool.length).toBeGreaterThan(0);
    const cats = "array['Goat','Vegan']";
    const recent = pool.slice(0, pool.length - 1);
    for (let i = 0; i < 10; i++) {
      const r = await db.query<{ id: string }>(`select id from public.pick_random_recipe(p_categories => ${cats}, p_recent => $1::uuid[])`, [recent]);
      expect(r.rows[0].id).toBe(pool[pool.length - 1]);
    }
    const all = await db.query(`select id from public.pick_random_recipe(p_categories => ${cats}, p_recent => $1::uuid[])`, [pool]);
    expect(all.rows).toHaveLength(1);
  });
});

describe("match_recipes parity with the TypeScript engine", () => {
  const index = toDiscoveryIndex(catalog);
  const graph = buildGraph(index.ingredients);
  const cases: { have: string[]; maxMissing: number; pantry: boolean }[] = [
    { have: ["chicken", "rice", "garlic", "onion", "egg"], maxMissing: 0, pantry: true },
    { have: ["chicken", "rice", "garlic", "onion", "egg"], maxMissing: 2, pantry: true },
    { have: ["egg", "milk", "flour", "butter", "sugar"], maxMissing: 0, pantry: true },
    { have: ["egg", "milk", "flour", "butter", "sugar"], maxMissing: 3, pantry: false },
    { have: ["potato", "onion", "tomato"], maxMissing: 1, pantry: true },
  ];

  it.each(cases)("$have / max missing $maxMissing / pantry $pantry", async ({ have, maxMissing, pantry }) => {
    const ts = matchRecipes(index.recipes, have, { mode: maxMissing === 0 ? "have" : "buy", maxMissing: Math.max(1, maxMissing), assumePantry: pantry, limit: 500 }, graph);
    const sql = await db.query<{ slug: string; selected_used: number; missing_required: number; missing_optional: number }>(
      "select * from public.match_recipes($1::text[], $2, $3, false, 500)",
      [have, maxMissing, pantry],
    );
    const tsRows = ts.results.map((m) => ({
      slug: m.recipe.slug,
      selected_used: m.selectedUsed,
      missing_required: m.missingRequired.length,
      missing_optional: m.missingOptional.length,
    }));
    const key = (r: { slug: string }) => r.slug;
    expect(sql.rows.map((r) => ({ ...r })).map((r) => ({ slug: r.slug, selected_used: r.selected_used, missing_required: r.missing_required, missing_optional: r.missing_optional })).sort((a, b) => key(a).localeCompare(key(b))))
      .toEqual([...tsRows].sort((a, b) => key(a).localeCompare(key(b))));
    // Same ranking up to ties on title collation.
    const rank = (r: { selected_used: number; missing_required: number }) => (maxMissing === 0 ? r.selected_used : r.selected_used - r.missing_required) * 100 - r.missing_required;
    expect(sql.rows.map(rank)).toEqual(tsRows.map(rank));
  });
});
