import Link from "next/link";
import { IngredientThumb } from "@/components/IngredientCombobox";
import { Icon } from "@/components/Icon";
import { SpinWheel } from "@/components/SpinWheel";
import { toSummary } from "@/lib/catalog-shared";
import { getCatalog, getPopularIngredients, getStats } from "@/lib/catalog";
import { PANTRY_STAPLES } from "@/lib/discovery/matching";
import { seededRng } from "@/lib/discovery/random";
import { isWheelEligible } from "@/lib/discovery/selection";
import { initialWheel } from "@/lib/discovery/wheel";

export default function Home() {
  const catalog = getCatalog();
  const eligible = catalog.recipes.map(toSummary).filter(isWheelEligible);
  // Deterministic first wheel so the static HTML is stable between builds.
  const initialSlices = initialWheel(eligible, 10, seededRng(eligible.length));
  const stats = getStats();
  const popular = getPopularIngredients(12, PANTRY_STAPLES);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-12">
        <div className="mb-8 max-w-3xl sm:mb-10">
          <p className="eyebrow">{stats.recipes.toLocaleString()} recipes · {stats.countries} countries</p>
          <h1 className="mt-3 text-[clamp(2.4rem,7vw,4.4rem)] font-semibold">
            Can’t decide what to cook? <span className="text-accent">Spin for it.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Every spin lands on a real recipe with its ingredients, method, video and source. Or tell us what’s in your
            kitchen and we’ll show what you can make.
          </p>
        </div>
        <SpinWheel initialSlices={initialSlices} />
      </section>

      <section aria-labelledby="cook-heading" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="eyebrow">Mode two</p>
            <h2 id="cook-heading" className="mt-2 text-4xl font-semibold">
              Cook with what you have
            </h2>
            <p className="mt-3 max-w-md text-muted">
              Pick your ingredients and choose <strong className="text-ink">Use what I have</strong> for recipes you can
              make right now, or <strong className="text-ink">I can buy a few things</strong> to allow a short shopping
              list. What you have and what you’re missing are always shown separately.
            </p>
            <Link href="/cook/" className="btn btn-primary mt-6">
              <Icon name="basket" size={18} />
              Open the ingredient finder
            </Link>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Start with a popular ingredient</p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {popular.map((ing) => (
                <li key={ing.id}>
                  <Link
                    href={`/cook/?have=${ing.id}`}
                    className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-bg p-2 text-center text-sm font-medium transition-colors hover:border-ink"
                  >
                    <IngredientThumb ingredient={ing} size={44} />
                    <span className="leading-tight">{ing.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="honest-heading" className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
        <h2 id="honest-heading" className="text-3xl font-semibold">
          Sourced, not made up
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-xl font-semibold">Real recipes</h3>
            <p className="mt-2 text-muted">
              Every dish comes from TheMealDB’s open recipe API, with credit and a link to the original source where one
              is listed ({Math.round((catalog.recipes.filter((r) => r.source.originalUrl).length / stats.recipes) * 100)}% of recipes).
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">Gaps stay gaps</h3>
            <p className="mt-2 text-muted">
              The source doesn’t publish cooking times, servings or difficulty, so we don’t guess them. Missing details are
              marked as not provided.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">Videos we’ve checked</h3>
            <p className="mt-2 text-muted">
              {stats.withVideo} recipes link a cooking video that was available when we last checked. Dead links are
              hidden rather than shown.
            </p>
          </div>
        </div>
        <Link href="/about/" className="mt-6 inline-flex items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:underline">
          How the data and matching work
          <Icon name="arrowRight" size={16} />
        </Link>
      </section>
    </>
  );
}
