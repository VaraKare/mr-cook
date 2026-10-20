-- Mr. Cook: initial schema for Supabase (PostgreSQL 15+).
--
-- The live GitHub Pages site is static and reads data/catalog.json. This
-- schema is the scale-out path: the same unified model, loadable with
-- `npm run export:sql`, plus server-side random selection and ingredient
-- matching functions that stay fast at 10k–50k+ recipes.
--
-- Access model
--   * Catalogue tables: anyone may read; only the service role (which
--     bypasses RLS) may write, so imports run server-side with a secret key.
--   * User tables: a signed-in user can only see and change their own rows.

-- ---------------------------------------------------------------- sources
create table public.recipe_sources (
  id           text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name         text not null,
  url          text,
  terms_url    text,
  attribution  text not null
);

-- ------------------------------------------------------------ ingredients
create table public.ingredients (
  id              text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  canonical_name  text not null unique,
  category        text,
  animal          text check (animal in ('meat', 'seafood')),
  icon_url        text check (icon_url is null or icon_url ~ '^https://'),
  -- Family, e.g. chicken-thighs -> chicken. One level deep by convention.
  parent_id       text references public.ingredients (id) on delete set null,
  check (parent_id is distinct from id)
);
create index ingredients_parent_idx on public.ingredients (parent_id) where parent_id is not null;

create table public.ingredient_aliases (
  alias          text primary key check (alias = lower(alias) and length(alias) between 1 and 80),
  ingredient_id  text not null references public.ingredients (id) on delete cascade
);
create index ingredient_aliases_ingredient_idx on public.ingredient_aliases (ingredient_id);

-- ---------------------------------------------------------------- recipes
create table public.recipes (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{1,200}$'),
  title             text not null check (length(title) between 1 and 300),
  alternate_title   text,
  description       text,
  country           text,
  cuisine           text,
  category          text,
  tags              text[] not null default '{}',
  -- Unknown stays NULL. Never back-filled with estimates.
  prep_minutes      integer check (prep_minutes >= 0),
  cook_minutes      integer check (cook_minutes >= 0),
  total_minutes     integer check (total_minutes >= 0),
  servings          integer check (servings > 0),
  difficulty        text check (difficulty in ('easy', 'medium', 'hard')),
  instructions      text[] not null default '{}',
  image_url         text check (image_url is null or image_url ~ '^https://'),
  source_id         text not null references public.recipe_sources (id),
  source_recipe_id  text not null,
  source_url        text,
  original_url      text,
  licence           text not null,
  attribution_text  text not null,
  meat_free         boolean not null default false,
  is_verified       boolean not null default false,
  quality_flags     text[] not null default '{}',
  -- Uniform random key for O(log n) random selection (see pick_random_recipe).
  random_key        double precision not null default random(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (source_id, source_recipe_id)
);
create index recipes_random_key_idx on public.recipes (random_key) where image_url is not null;
create index recipes_category_idx on public.recipes (category);
create index recipes_country_idx on public.recipes (country);
create index recipes_total_minutes_idx on public.recipes (total_minutes) where total_minutes is not null;

create table public.recipe_ingredients (
  recipe_id      uuid not null references public.recipes (id) on delete cascade,
  ingredient_id  text not null references public.ingredients (id),
  position       smallint not null,
  source_name    text not null,
  measure        text,
  quantity       numeric check (quantity >= 0),
  unit           text,
  is_optional    boolean not null default false,
  primary key (recipe_id, ingredient_id)
);
-- The matching query starts from ingredients, so this index matters most.
create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id, recipe_id);

create table public.recipe_videos (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references public.recipes (id) on delete cascade,
  youtube_video_id  text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title             text,
  channel_title     text,
  video_url         text not null check (video_url ~ '^https://www\.youtube\.com/'),
  origin            text not null check (origin in ('source', 'youtube-search')),
  status            text not null default 'unchecked' check (status in ('ok', 'unavailable', 'unchecked')),
  last_checked_at   timestamptz,
  unique (recipe_id, youtube_video_id)
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- user data
create table public.user_preferences (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  dietary_preferences   text[] not null default '{}',
  excluded_ingredients  text[] not null default '{}',
  max_cooking_minutes   integer check (max_cooking_minutes > 0),
  updated_at            timestamptz not null default now()
);

create table public.saved_recipes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  recipe_id   uuid not null references public.recipes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- --------------------------------------------------------------- access
alter table public.recipe_sources     enable row level security;
alter table public.ingredients        enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_videos      enable row level security;
alter table public.user_preferences   enable row level security;
alter table public.saved_recipes      enable row level security;

create policy "catalogue is public" on public.recipe_sources     for select to anon, authenticated using (true);
create policy "catalogue is public" on public.ingredients        for select to anon, authenticated using (true);
create policy "catalogue is public" on public.ingredient_aliases for select to anon, authenticated using (true);
create policy "catalogue is public" on public.recipes            for select to anon, authenticated using (true);
create policy "catalogue is public" on public.recipe_ingredients for select to anon, authenticated using (true);
create policy "catalogue is public" on public.recipe_videos      for select to anon, authenticated using (true);

create policy "own preferences" on public.user_preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own saved recipes" on public.saved_recipes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Belt and braces: clients never write the catalogue, even if a policy is added by mistake.
revoke insert, update, delete, truncate on
  public.recipe_sources, public.ingredients, public.ingredient_aliases,
  public.recipes, public.recipe_ingredients, public.recipe_videos
from anon, authenticated;
revoke all on public.user_preferences, public.saved_recipes from anon;

-- ------------------------------------------------------ helper: families
-- Ingredient ids that the given ids can stand in for: themselves, their
-- family, and their family members (siblings are NOT interchangeable).
create or replace function public.expand_ingredients(p_ids text[])
returns text[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select unnest(p_ids) as x
    union select i.parent_id from public.ingredients i where i.id = any(p_ids) and i.parent_id is not null
    union select i.id from public.ingredients i where i.parent_id = any(p_ids)
  ) s;
$$;

-- --------------------------------------------- random selection (wheel)
-- Strategy: every recipe carries an indexed uniform random_key. Draw r in
-- [0,1) and take the first eligible recipe with random_key >= r, wrapping to
-- the start if none. This is an index range scan instead of the
-- full-table sort that ORDER BY random() needs.
--
-- Trade-off: a recipe's chance is proportional to the gap before its key,
-- so it is only approximately uniform. Re-draw keys periodically
-- (`update recipes set random_key = random()`, e.g. weekly with pg_cron)
-- to keep long-run fairness. Recently served ids are skipped when possible.
create or replace function public.pick_random_recipe(
  p_meat_free   boolean default false,
  p_categories  text[]  default null,
  p_countries   text[]  default null,
  p_excluded    text[]  default null,
  p_max_minutes integer default null,
  p_recent      uuid[]  default '{}'
) returns setof public.recipes
language plpgsql volatile set search_path = '' as $$
declare
  r double precision := random();
  excluded text[] := (
    select coalesce(array_agg(distinct x), '{}') from (
      select unnest(coalesce(p_excluded, '{}')) as x
      union select i.id from public.ingredients i where i.parent_id = any(coalesce(p_excluded, '{}'))
    ) s
  );
  avoid uuid[] := coalesce(p_recent, '{}');
  attempt int;
begin
  for attempt in 1..2 loop
    return query
      with eligible as (
        select rc.* from public.recipes rc
        where rc.image_url is not null
          and (not p_meat_free or rc.meat_free)
          and (p_categories is null or rc.category = any(p_categories))
          and (p_countries is null or rc.country = any(p_countries))
          and (p_max_minutes is null or rc.total_minutes is null or rc.total_minutes <= p_max_minutes)
          and not (rc.id = any(avoid))
          and not exists (
            select 1 from public.recipe_ingredients ri
            where ri.recipe_id = rc.id and ri.ingredient_id = any(excluded)
          )
      )
      (select * from eligible where random_key >= r order by random_key limit 1)
      union all
      (select * from eligible where random_key < r order by random_key limit 1)
      limit 1;
    if found then return; end if;
    -- Everything eligible was recent: allow repeats rather than return nothing.
    avoid := '{}';
  end loop;
end;
$$;

-- ---------------------------------------------- ingredient matching
-- Mirrors src/lib/discovery/matching.ts (tested for parity).
--   p_max_missing = 0  -> "Use what I have"
--   p_max_missing 1..5 -> "I can buy a few more things"
create or replace function public.match_recipes(
  p_have          text[],
  p_max_missing   integer default 0,
  p_assume_pantry boolean default true,
  p_meat_free     boolean default false,
  p_limit         integer default 60
) returns table (
  recipe_id         uuid,
  slug              text,
  title             text,
  selected_used     integer,
  missing_required  integer,
  missing_optional  integer,
  have_ids          text[],
  missing_ids       text[]
)
language sql stable set search_path = '' as $$
  with params as (
    select
      public.expand_ingredients(p_have) as have,
      case when p_assume_pantry then public.expand_ingredients(
        array['salt', 'pepper', 'black-pepper', 'water', 'oil', 'vegetable-oil', 'olive-oil', 'sunflower-oil']
      ) else '{}'::text[] end as pantry,
      greatest(0, least(5, p_max_missing)) as max_missing
  ),
  candidates as (
    select distinct ri.recipe_id
    from public.recipe_ingredients ri, params p
    where ri.ingredient_id = any(p.have)
  ),
  scored as (
    select
      rc.id, rc.slug, rc.title,
      count(*) filter (where not ri.is_optional and not ri.ingredient_id = any(p.have) and not ri.ingredient_id = any(p.pantry))::int as missing_required,
      count(*) filter (where ri.is_optional and not ri.ingredient_id = any(p.have) and not ri.ingredient_id = any(p.pantry))::int as missing_optional,
      coalesce(array_agg(ri.ingredient_id order by ri.position) filter (where ri.ingredient_id = any(p.have)), '{}') as have_ids,
      coalesce(array_agg(ri.ingredient_id order by ri.position) filter (where not ri.is_optional and not ri.ingredient_id = any(p.have) and not ri.ingredient_id = any(p.pantry)), '{}') as missing_ids,
      (
        select count(*)::int from unnest(p_have) s
        where public.expand_ingredients(array[s]) && array_agg(ri.ingredient_id)
      ) as selected_used,
      p.max_missing
    from candidates c
    join public.recipes rc on rc.id = c.recipe_id
    join public.recipe_ingredients ri on ri.recipe_id = rc.id
    cross join params p
    where (not p_meat_free or rc.meat_free)
    group by rc.id, p.max_missing
  )
  select id, slug, title, selected_used, missing_required, missing_optional, have_ids, missing_ids
  from scored
  where selected_used > 0 and missing_required <= max_missing
  order by
    case when max_missing = 0 then selected_used else selected_used - missing_required end desc,
    missing_required asc,
    selected_used desc,
    missing_optional asc,
    title asc
  limit greatest(1, least(500, p_limit));
$$;

grant execute on function public.pick_random_recipe(boolean, text[], text[], text[], integer, uuid[]) to anon, authenticated;
grant execute on function public.match_recipes(text[], integer, boolean, boolean, integer) to anon, authenticated;
grant execute on function public.expand_ingredients(text[]) to anon, authenticated;
