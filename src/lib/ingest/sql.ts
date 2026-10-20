import type { Catalog } from "../types";

/*
 * Render the unified catalogue as idempotent SQL for the Supabase schema.
 * Recipe UUIDs are derived from the source id (md5), so re-running the seed
 * updates rows instead of duplicating them.
 */

type Value = string | number | boolean | null | undefined | string[];

export function lit(value: Value): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number in seed: ${value}`);
    return String(value);
  }
  if (Array.isArray(value)) return value.length ? `ARRAY[${value.map(lit).join(", ")}]::text[]` : "'{}'::text[]";
  // standard_conforming_strings is on: only single quotes need escaping.
  return `'${value.replace(/'/g, "''").replace(/\u0000/g, "")}'`;
}

const uuidFor = (sourceId: string, recipeId: string) => `md5(${lit(`${sourceId}:${recipeId}`)})::uuid`;
const sourceKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function catalogToSql(catalog: Catalog): string {
  const out: string[] = ["begin;"];

  for (const s of catalog.sources) {
    out.push(
      `insert into public.recipe_sources (id, name, url, terms_url, attribution) values (${lit(sourceKey(s.name))}, ${lit(s.name)}, ${lit(s.url)}, ${lit(s.terms)}, ${lit(s.attribution)}) on conflict (id) do update set name = excluded.name, url = excluded.url, terms_url = excluded.terms_url, attribution = excluded.attribution;`,
    );
  }

  // Parents first so the self-reference is satisfied, then set parents.
  for (const i of catalog.ingredients) {
    out.push(
      `insert into public.ingredients (id, canonical_name, category, animal, icon_url) values (${lit(i.id)}, ${lit(i.name)}, ${lit(i.type)}, ${lit(i.animal)}, ${lit(i.iconUrl)}) on conflict (id) do update set canonical_name = excluded.canonical_name, category = excluded.category, animal = excluded.animal, icon_url = excluded.icon_url;`,
    );
  }
  for (const i of catalog.ingredients) {
    if (i.parentId) out.push(`update public.ingredients set parent_id = ${lit(i.parentId)} where id = ${lit(i.id)};`);
  }
  for (const [alias, id] of Object.entries(catalog.aliases)) {
    out.push(
      `insert into public.ingredient_aliases (alias, ingredient_id) values (${lit(alias.slice(0, 80))}, ${lit(id)}) on conflict (alias) do update set ingredient_id = excluded.ingredient_id;`,
    );
  }

  for (const r of catalog.recipes) {
    const src = sourceKey(r.source.name);
    const id = uuidFor(src, r.source.recipeId);
    out.push(
      `insert into public.recipes (id, slug, title, alternate_title, description, country, cuisine, category, tags, prep_minutes, cook_minutes, total_minutes, servings, difficulty, instructions, image_url, source_id, source_recipe_id, source_url, original_url, licence, attribution_text, meat_free, is_verified, quality_flags) values (${[
        id,
        lit(r.slug),
        lit(r.title),
        lit(r.alternateTitle),
        lit(r.description),
        lit(r.country),
        lit(r.cuisine),
        lit(r.category),
        lit(r.tags),
        lit(r.prepMinutes),
        lit(r.cookMinutes),
        lit(r.totalMinutes),
        lit(r.servings),
        lit(r.difficulty),
        lit(r.instructions),
        lit(r.imageUrl),
        lit(src),
        lit(r.source.recipeId),
        lit(r.source.providerUrl),
        lit(r.source.originalUrl),
        lit(r.source.licence),
        lit(r.source.attribution),
        lit(r.meatFree),
        lit(r.isVerified),
        lit(r.flags),
      ].join(", ")}) on conflict (source_id, source_recipe_id) do update set slug = excluded.slug, title = excluded.title, alternate_title = excluded.alternate_title, country = excluded.country, cuisine = excluded.cuisine, category = excluded.category, tags = excluded.tags, instructions = excluded.instructions, image_url = excluded.image_url, original_url = excluded.original_url, meat_free = excluded.meat_free, quality_flags = excluded.quality_flags;`,
    );
    out.push(`delete from public.recipe_ingredients where recipe_id = ${id};`);
    r.ingredients.forEach((ri, position) => {
      out.push(
        `insert into public.recipe_ingredients (recipe_id, ingredient_id, position, source_name, measure, quantity, unit, is_optional) values (${id}, ${lit(ri.ingredientId)}, ${position}, ${lit(ri.sourceName)}, ${lit(ri.measure)}, ${lit(ri.quantity)}, ${lit(ri.unit)}, ${lit(ri.isOptional)});`,
      );
    });
    for (const v of r.videos) {
      out.push(
        `insert into public.recipe_videos (recipe_id, youtube_video_id, title, channel_title, video_url, origin, status, last_checked_at) values (${id}, ${lit(v.youtubeId)}, ${lit(v.title)}, ${lit(v.channelTitle)}, ${lit(v.url)}, ${lit(v.origin)}, ${lit(v.status)}, ${lit(v.lastCheckedAt)}) on conflict (recipe_id, youtube_video_id) do update set title = excluded.title, channel_title = excluded.channel_title, status = excluded.status, last_checked_at = excluded.last_checked_at;`,
      );
    }
  }

  out.push("commit;");
  return out.join("\n") + "\n";
}
