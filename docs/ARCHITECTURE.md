# Mr. Cook architecture and decisions

This document turns the product brief ("Spin & Cook", working name) into what was built. It records the decisions that shaped the MVP and the plan for growing the catalogue.

## 1. Product summary

A food-discovery site that makes choosing what to cook fun and useful. There are two modes over one shared recipe database:

| Mode | What the user does | What the system guarantees |
| --- | --- | --- |
| **Surprise me** | Optionally sets filters, then spins | The recipe is selected first (uniformly at random, avoiding recent repeats), then the wheel lands on exactly that recipe |
| **Cook with what I have** | Picks ingredients, chooses *Use what I have* or *I can buy a few* (1–5 missing) | Have, assumed basics, missing-required and missing-optional ingredients are always shown separately; nothing with a required ingredient missing is shown as cookable |

## 2. Key decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Hosting | **GitHub Pages**, a static export from Next.js 16 (App Router, TypeScript, Tailwind CSS 4) | Requested by the owner, with zero running cost. All 790 recipe pages are pre-rendered for speed and search engines |
| "Backend" for the MVP | Build-time data plus a small browser index (`public/data/discovery.json`, about 515 KB raw, about 80 KB gzipped) | GitHub Pages can't run server code or keep secrets. At 790 recipes, selection and matching take under 5 ms in the browser |
| Database | Supabase/Postgres schema **designed, migrated and tested**, but not required at runtime | Gives a tested path to 10k–50k+ recipes without paying for or operating a database before it's needed |
| Recipe source | TheMealDB official JSON API (790 recipes) | Free for development and education, terms allow copying API content with credit, and it includes country, source URL and YouTube links |
| YouTube | Source-provided links, checked with oEmbed (no API key) | No secret is needed on a static host and no quota is used. The YouTube Data API is deferred (see §7) |
| Saved recipes | `localStorage`, with no accounts | The PRD allows saving without an account for the MVP. Accounts are out of MVP scope |
| Analytics | None | Privacy by default. No consent banner needed |

### Paid services

None. A **TheMealDB supporter key** is recommended before any public commercial launch (their free key `1` is for development and education). The importer reads `MEALDB_API_KEY` from an Actions secret when it's set.

## 3. Design brief (as built)

* **Concept.** A warm kitchen: cream paper, tomato red, saffron and herb green, with editorial serif headings. It should feel like a recipe book on a table, not a dashboard.
* **Signature element.** The wheel is drawn as a serving platter. Each wedge is a slice of a real dish photo, the selected wedge stays lit after landing, and the hub *is* the Spin button.
* **Tokens** (`src/app/globals.css`). Light: bg `#f7f1e6`, surface `#fffbf4`, ink `#241f1a`, muted `#645a4f`, line `#e0d4c1`, accent `#b23c25`, herb `#3c6636`, saffron `#e2a23b`. The dark theme follows `prefers-color-scheme`. All colours are flat: no gradients, glows or glass.
* **Type.** Fraunces (display, variable optical size) and Inter (body), self-hosted at build time by `next/font`. Body text is 16 px with 1.6 line height. h1 is `clamp(2.2–2.4rem → 3.6–4.4rem)`.
* **Status chips.** Have = solid herb. Basics = outline. Missing = dashed tomato with a "+". Optional = dashed muted. Status never relies on colour alone: there is always a text label or symbol, plus screen-reader text.
* **Motion.** The spin is a transform-only CSS transition (4.2 s ease-out). With `prefers-reduced-motion` it's one turn in 0.4 s.
* **Accessibility.** Skip link, landmarks, a single h1 per page, visible focus rings, keyboard-operable WAI-ARIA combobox for ingredients, `aria-pressed` toggles, `aria-live` result announcements, and 44 px touch targets.

## 4. Data model

The unified schema lives in `src/lib/types.ts` and is mirrored in `supabase/migrations/20261020000000_init.sql`:

`recipe_sources`, `recipes`, `ingredients` (with `parent_id` families), `ingredient_aliases`, `recipe_ingredients` (source name, raw measure, parsed quantity/unit, `is_optional`), `recipe_videos`, `user_preferences`, `saved_recipes`.

Rules:

* Unknown stays `NULL`. TheMealDB provides no times, servings or difficulty, so these are null for every recipe, and each recipe is flagged `missing-times`.
* `country` comes from TheMealDB's `strCountry`. `cuisine` is their `strArea`, which is a cuisine label, not a place.
* Every recipe keeps its source name, source id, provider URL, original URL, licence note and attribution.
* `is_verified` is false for all imported data.

### Ingestion (`scripts/import-themealdb.ts`, `src/lib/ingest/`)

1. Fetch `search.php?f=a…z` and the ingredient list (retries, timeouts). Any failed letter aborts the import, so a partial catalogue is never written.
2. Deduplicate by source id, and skip records with no id or title.
3. Normalise ingredient names: accents and punctuation, spelling variants (chili/chilli, yoghurt), a synonym table (cilantro→coriander, scallion→spring onion, shrimp→prawns…), and plural→singular **only when the singular already exists** (so "molasses" survives).
4. Assign families (e.g. chicken thighs → chicken, plum tomatoes → tomato) with explicit exclusions (coconut milk ≠ milk, rice flour ≠ flour, chicken stock ≠ chicken).
5. Classify ingredients as meat or seafood by name and source type. Four known errors in the source's `strType` are overridden (it marks pistachio and rye as *Meat*, and bok choi and galangal paste as *Fish*).
6. Parse measures into quantity and unit where unambiguous, always keeping the raw text. Mark "to serve", "garnish" and "optional" items as optional.
7. Check every linked YouTube video through oEmbed (cached in `data/video-checks.json`, re-checked after 30 days). Unavailable videos are hidden.
8. Flag quality issues and write `data/catalog.json` and `data/import-report.json`.

The current import has 790 recipes, 911 canonical ingredients, 586 with a video link (34 of those now unavailable), 753 with an original-source URL, and 790 with a country.

## 5. Random selection

**MVP (browser).** Filter the index (needs a photo, plus the user's filters) → remove the last 40 recipes served → pick uniformly with `crypto.getRandomValues`. If everything eligible was recent, reuse the one served longest ago. This is O(n), about 1 ms at 790 recipes.

**Wheel consistency.** `placeOnWheel` puts the chosen recipe on the platter. If it isn't already showing, it replaces the wedge opposite the pointer, which is out of view. `targetRotation` then computes a rotation of 5 or more full turns that ends inside that wedge (with jitter limited to ±35% of the wedge). A test runs 2,000 random spins across 4 wheel sizes and asserts `sliceUnderPointer(targetRotation(...)) === target`. A browser check confirmed that the element under the pointer matches the result card.

**At scale (Supabase).** `pick_random_recipe` uses an indexed `random_key`: draw r, take the first eligible row with `random_key >= r`, and wrap around if there is none. This is an index range scan rather than `ORDER BY random()` over the whole table. The trade-off: a row's probability is proportional to the key gap before it, so the result is approximately uniform. Re-drawing keys periodically (`update recipes set random_key = random()`, e.g. weekly with pg_cron) keeps long-run fairness. Recent IDs are passed in and skipped while alternatives exist.

## 6. Ingredient matching and ranking

For a selection S, the "have" set is S plus each selected item's family parent and family members. Siblings are not interchangeable: chicken thighs don't satisfy chicken breast. With **I have the basics** on, salt, pepper, black pepper, water and the cooking oils are assumed. Each recipe ingredient is then **have**, **basic**, **missing required** or **missing optional**. A recipe must use at least one selected ingredient.

| Mode | Filter | Order |
| --- | --- | --- |
| Use what I have | missing required = 0 | selected used ↓, optional missing ↑, title |
| I can buy a few (N = 1–5) | missing required ≤ N | (selected used − missing required) ↓, missing required ↑, selected used ↓, optional missing ↑, title |

In *Use what I have* mode, when fewer than 6 recipes match, the page also shows up to 6 "Almost there" recipes that are missing 1–2 ingredients, clearly labelled. `match_recipes` in SQL implements the same rules, and a test checks it against the TypeScript engine on real data.

## 7. Phase status

| Phase | Status |
| --- | --- |
| 1. Environment and structure | Done |
| 2. Next.js app, design system, homepage | Done |
| 3. Supabase schema and config | Migration written and tested on PGlite. **Not connected to a live Supabase project** (not needed for the static MVP) |
| 4. Recipe source import | Done (TheMealDB, 790 recipes) |
| 5. Recipe pages and spin wheel | Done |
| 6. Ingredient search, selection, matching | Done |
| 7. YouTube | Source links checked via oEmbed and embedded click-to-load. **The YouTube Data API search is not implemented**: it needs a server-held key, so the 238 recipes without a working video (204 with no link, 34 with a dead one) show a YouTube search link instead |
| 8. Errors, tests, mobile, security | Done (73 tests). See the README for the privacy and CSP notes |
| 9. Deploy and docs | GitHub Pages via Actions |
| 10. Catalogue expansion | Planned (§8) |

### Security notes

* The site needs no secrets. `MEALDB_API_KEY` is used only by the importer in CI and is never logged (error messages omit the request URL).
* GitHub Pages can't set response headers, so a CSP is delivered by `<meta>`: same-origin scripts, images only from self/TheMealDB/YouTube thumbnails, frames only from youtube-nocookie.com, and `object-src 'none'`. `'unsafe-inline'` for scripts is required by Next.js's inline bootstrap on a static host without nonces.
* User input never reaches HTML unescaped (React escaping, no `dangerouslySetInnerHTML` except JSON-LD, where `<` is escaped). URL parameters are validated against `^[a-z0-9-]{1,60}$` and capped at 30 items.
* Supabase: catalogue tables are read-only for clients (RLS policies plus explicit `REVOKE`). User tables are owner-only via `auth.uid()`. Functions use an empty `search_path`.

## 8. Catalogue expansion plan (toward 10k–50k recipes)

1. **Get a TheMealDB supporter key**, which covers production use and their premium endpoints.
2. **Switch the runtime to Supabase** once the browser index stops being small (above about 3–5k recipes, or about 2 MB of index). Pages call `pick_random_recipe` and `match_recipes` through supabase-js using the anon key, which is safe because RLS makes the catalogue read-only. Recipe pages can stay statically generated, or move to a host with ISR.
3. **Add sources one importer at a time**, each mapping into `src/lib/types.ts` and recording licence and attribution. Candidates to evaluate, checking licence first:
   * *Spoonacular API.* Paid tiers; terms restrict long-term storage, so it may only be usable for live lookups.
   * *Edamam.* Paid; similar caching limits.
   * *Openly licensed datasets* (e.g. Wikibooks Cookbook, CC BY-SA). Storage and redistribution are allowed, but share-alike obligations apply to derived content.
   * Datasets of scraped recipes (e.g. RecipeNLG, Food.com dumps) are **not** suitable without per-source rights. Being publicly accessible is not the same as being licensed.
4. **Cross-source deduplication**: normalised title, plus ingredient-set Jaccard similarity above 0.8, plus country; keep the record with the richest data and link the others.
5. **YouTube Data API enrichment** in a server job (key in an Actions or Supabase secret): search `"<title> recipe"` only for recipes without a source video, at about 100 searches per day within the default quota. Cache results in `recipe_videos` with `origin = 'youtube-search'` and refresh within the API's 30-day data-storage limit.
6. **Times and servings**: only from sources that publish them. Never estimated.
