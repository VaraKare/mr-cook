# Mr. Cook

**Can't decide what to cook? Spin for it.**

Mr. Cook is a food-discovery site with two ways in, both backed by one shared recipe database:

1. **Surprise me.** Spin a wheel and land on a real recipe, with its ingredients, method, country, video and source.
2. **Cook with what I have.** Pick ingredients and see what you can make right now (*Use what I have*) or with a short shopping list (*I can buy a few*).

Live site: **https://varakare.github.io/mr-cook/**

The catalogue holds 790 recipes from 63 countries, imported from [TheMealDB](https://www.themealdb.com/). Nothing is invented: when the source doesn't give a value, such as cooking time, the site shows it as not provided.

## Quick start

Requires Node.js 20.9 or later (CI uses 22).

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server (builds the browser index first) |
| `npm run build` | Static export to `out/` |
| `npm run check` | Type-check, lint and all tests |
| `npm test` | Unit, import and database tests (Vitest + PGlite) |
| `npm run import:mealdb` | Re-import the catalogue from TheMealDB and re-check video links |
| `npm run export:sql` | Write `supabase/seed.sql` for the optional Supabase backend |

No accounts or API keys are needed to run, build or deploy the site.

## How it works

```
TheMealDB API ──► scripts/import-themealdb.ts ──► data/catalog.json (committed)
                    normalise · dedupe · flag            │
                    check videos (oEmbed)                ├─► recipe pages (790, pre-rendered)
                                                         └─► public/data/discovery.json
                                                                 │
                                         wheel + ingredient finder (in the browser)
```

* **Importer** (`src/lib/ingest/`): maps source records into one internal schema (`src/lib/types.ts`). It normalises ingredient names (synonyms, plurals, spelling variants), groups families such as *chicken → chicken thighs*, parses measures, marks garnish/"to serve" items as optional, deduplicates by source id and flags missing data. Re-running it is safe and deterministic.
* **Random selection** (`src/lib/discovery/selection.ts`): picks uniformly from every eligible recipe using `crypto.getRandomValues`, skips the last 40 dishes you saw, and cycles oldest-first once you've seen them all. **The recipe is chosen before the wheel moves**, and `wheel.ts` computes the rotation that lands on it. Both steps are tested.
* **Matching** (`src/lib/discovery/matching.ts`): separates *have*, *assumed basics*, *missing required* and *missing optional* ingredients, and ranks with a documented score. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
* **Supabase path** (`supabase/migrations/`): the same model as a Postgres schema with row-level security, plus indexed `pick_random_recipe` and `match_recipes` functions for catalogues of 10k–50k+ recipes. Tests run the migration on PGlite and check that the SQL matching agrees with the TypeScript engine.

## Deploying

`.github/workflows/deploy.yml` tests, builds and deploys to GitHub Pages on every push to `main`. It also re-imports the catalogue weekly; if the import fails, it builds from the committed snapshot instead. Pages must be set to **Source: GitHub Actions**.

Optional secret: `MEALDB_API_KEY` (TheMealDB supporter key, recommended for a public production launch).

## Data, licensing and honesty

* Recipe data and imagery: **TheMealDB** (https://www.themealdb.com/). Their terms allow copying content returned by the API, require credit, and forbid scraping the website. The importer uses only the official API. The free key `1` is intended for development and educational use; get a supporter key before any commercial launch.
* Recipe pages link to the original source when TheMealDB lists one (753 of 790 recipes).
* Videos are only those the source links. Each is checked through YouTube oEmbed, and unavailable ones are hidden. Video IDs are never generated.
* "No meat or fish listed" is derived from each recipe's ingredients, because the source's *Vegetarian* category isn't reliable (14 recipes in it list chicken stock, bacon, fish sauce, etc.). **No filter is an allergy or dietary guarantee.**
* Privacy: no accounts, analytics, cookies or trackers. Saved recipes live in your browser's localStorage. The YouTube player loads only on click, via youtube-nocookie.com.

## Project docs

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): design brief, decisions, scoring and selection strategy, phase status and roadmap.
