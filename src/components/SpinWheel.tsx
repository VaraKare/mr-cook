"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyFilters, type DiscoveryFilters } from "@/lib/discovery/filters";
import { cryptoRng } from "@/lib/discovery/random";
import { isWheelEligible, pickRecipe, rememberRecent } from "@/lib/discovery/selection";
import { initialWheel, placeOnWheel, sliceAngle, targetRotation } from "@/lib/discovery/wheel";
import { imageVariant, recipePath } from "@/lib/site";
import { readRecent, useSavedRecipes, useStoredFilters, writeRecent } from "@/lib/storage";
import type { RecipeSummary } from "@/lib/types";
import { useDiscovery } from "@/lib/useDiscovery";
import { Icon } from "./Icon";
import { IngredientCombobox } from "./IngredientCombobox";
import { YouTubeButton } from "./YouTubeButton";

const SIZE = 10;
const C = 200;
const R = 186;
const SPIN_MS = 4200;
const SPIN_MS_REDUCED = 400;
const SLICE_COLORS = ["var(--slice-a)", "var(--slice-b)", "var(--slice-c)", "var(--slice-d)"];

type Phase = "idle" | "spinning" | "landed";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: C + radius * Math.sin(a), y: C - radius * Math.cos(a) };
}

export function SpinWheel({ initialSlices }: { initialSlices: RecipeSummary[] }) {
  const { discovery, error, retry } = useDiscovery();
  const reducedMotion = usePrefersReducedMotion();
  const rng = useMemo(() => cryptoRng(), []);
  const { isSaved, toggle } = useSavedRecipes();

  const [filters, setFilters] = useStoredFilters();
  const [slices, setSlices] = useState<RecipeSummary[]>(initialSlices);
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RecipeSummary | null>(null);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
  const [repeated, setRepeated] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const autoSpin = useRef(false);

  const pending = useRef<{ recipe: RecipeSummary; index: number; repeated: boolean } | null>(null);
  const fallbackTimer = useRef<number | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  // Honour "?spin=1" from a recipe page's "Spin another" link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("spin") === "1") {
      autoSpin.current = true;
      params.delete("spin");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const pool = useMemo(() => {
    if (!discovery) return null;
    return applyFilters(discovery.index.recipes.filter(isWheelEligible), filters, discovery.graph);
  }, [discovery, filters]);

  const categories = useMemo(
    () => [...new Set(discovery?.index.recipes.map((r) => r.category).filter((c): c is string => !!c))].sort(),
    [discovery],
  );
  const countries = useMemo(
    () => [...new Set(discovery?.index.recipes.map((r) => r.country).filter((c): c is string => !!c))].sort(),
    [discovery],
  );

  const updateFilters = setFilters;

  // Refill the wheel when the filters change (state adjusted during render,
  // as React recommends for derived resets). The server-rendered slices
  // correspond to "no filters".
  const filterKey = JSON.stringify(filters);
  const [slicesFor, setSlicesFor] = useState("{}");
  if (pool && phase !== "spinning" && slicesFor !== filterKey) {
    setSlicesFor(filterKey);
    if (pool.length > 0) setSlices(initialWheel(pool, SIZE, rng));
    setLandedIndex(null);
  }

  const finishSpin = useCallback(() => {
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setPhase("landed");
    setResult(p.recipe);
    setLandedIndex(p.index);
    setRepeated(p.repeated);
    writeRecent(rememberRecent(readRecent(), p.recipe.id));
    setAnnouncement(`The wheel landed on ${p.recipe.title}${p.recipe.country ? `, from ${p.recipe.country}` : ""}.`);
    window.requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight - 120) el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    });
  }, [reducedMotion]);

  const spin = useCallback(() => {
    if (!discovery || !pool || phase === "spinning") return;
    // 1. The selection happens first, from the full eligible catalogue...
    const pick = pickRecipe(discovery.index.recipes, { filters, recentIds: readRecent(), rng, graph: discovery.graph });
    if (!pick.recipe) {
      setAnnouncement("No dishes match these filters.");
      return;
    }
    // 2. ...then the wheel is arranged and rotated to land exactly on it.
    const placed = placeOnWheel(pick.recipe, slices, pool, SIZE, rotation, rng);
    const turns = reducedMotion ? 1 : 5;
    const next = targetRotation(rotation, placed.targetIndex, SIZE, turns, rng() * 2 - 1);
    pending.current = { recipe: pick.recipe, index: placed.targetIndex, repeated: pick.repeated };
    setSlices(placed.slices);
    setLandedIndex(null);
    setPhase("spinning");
    setAnnouncement("Spinning…");
    setRotation(next);
    fallbackTimer.current = window.setTimeout(finishSpin, (reducedMotion ? SPIN_MS_REDUCED : SPIN_MS) + 400);
  }, [discovery, pool, phase, filters, rng, slices, rotation, reducedMotion, finishSpin]);

  useEffect(() => {
    if (!autoSpin.current || !discovery || !pool) return;
    autoSpin.current = false;
    // Next frame, so the wheel paints before the transition starts.
    const id = window.requestAnimationFrame(spin);
    return () => window.cancelAnimationFrame(id);
  }, [discovery, pool, spin]);

  useEffect(() => () => {
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
  }, []);

  const seg = sliceAngle(SIZE);
  const half = seg / 2;
  const left = polar(-half, R);
  const right = polar(half, R);
  const wedge = `M ${C} ${C} L ${left.x.toFixed(2)} ${left.y.toFixed(2)} A ${R} ${R} 0 0 1 ${right.x.toFixed(2)} ${right.y.toFixed(2)} Z`;
  const imageWidth = 2 * R * Math.sin((half * Math.PI) / 180) * 1.08;

  const ready = !!discovery && !!pool;
  const empty = ready && pool!.length === 0;
  const activeFilterCount =
    (filters.meatFree ? 1 : 0) +
    (filters.categories?.length ? 1 : 0) +
    (filters.countries?.length ? 1 : 0) +
    (filters.excludedIngredientIds?.length ?? 0);
  const duration = reducedMotion ? SPIN_MS_REDUCED : SPIN_MS;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12">
      <div className="flex flex-col items-center gap-5">
        {/* The platter */}
        <div className="relative w-full max-w-[min(100%,460px)]">
          <div className="relative aspect-square w-full">
            <div
              className="wheel-rotor absolute inset-0"
              data-rotation={rotation}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: phase === "spinning" ? `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.2, 1)` : "none",
              }}
              onTransitionEnd={(e) => {
                if (e.target === e.currentTarget && e.propertyName === "transform") finishSpin();
              }}
            >
              <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label={`Recipe wheel showing ${slices.length} dishes`}>
                <defs>
                  <clipPath id="wedge">
                    <path d={wedge} />
                  </clipPath>
                </defs>
                <circle cx={C} cy={C} r={198} fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth={1.5} />
                {slices.map((recipe, i) => {
                  const dim = phase === "landed" && landedIndex !== null && landedIndex !== i;
                  const href = imageVariant(recipe.imageUrl, "large");
                  return (
                    <g
                      key={`${i}-${recipe.id}`}
                      data-recipe-id={recipe.id}
                      transform={`rotate(${(i + 0.5) * seg} ${C} ${C})`}
                      style={{ opacity: dim ? 0.38 : 1, transition: "opacity 300ms ease" }}
                    >
                      <path d={wedge} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                      {href && (
                        <image
                          href={href}
                          x={C - imageWidth / 2}
                          y={C - R}
                          width={imageWidth}
                          height={R}
                          preserveAspectRatio="xMidYMid slice"
                          clipPath="url(#wedge)"
                        />
                      )}
                      <path d={wedge} fill="none" stroke="var(--bg)" strokeWidth={3} strokeLinejoin="round" />
                    </g>
                  );
                })}
                {Array.from({ length: SIZE }, (_, i) => {
                  const p1 = polar(i * seg, R + 3);
                  const p2 = polar(i * seg, R + 9);
                  return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--line-strong)" strokeWidth={2} strokeLinecap="round" />;
                })}
                <circle cx={C} cy={C} r={50} fill="var(--surface)" stroke="var(--bg)" strokeWidth={6} />
              </svg>
            </div>

            {/* Pointer: fixed, outside the rotor */}
            <svg viewBox="0 0 400 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <path d="M 200 40 L 186 6 Q 200 0 214 6 Z" fill="var(--ink)" stroke="var(--bg)" strokeWidth={3} strokeLinejoin="round" />
            </svg>

            {/* Hub button */}
            <button
              type="button"
              onClick={spin}
              disabled={!ready || empty || phase === "spinning"}
              aria-label={phase === "landed" ? "Spin the wheel again" : "Spin the wheel"}
              className="absolute top-1/2 left-1/2 flex aspect-square w-[23%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent font-display text-[clamp(0.95rem,3.6vw,1.3rem)] font-semibold text-on-accent transition-transform hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            >
              {phase === "spinning" ? "…" : "Spin"}
            </button>
          </div>
        </div>

        <div className="flex w-full max-w-[460px] flex-col items-stretch gap-3">
          <button type="button" className="btn btn-primary w-full text-lg" onClick={spin} disabled={!ready || empty || phase === "spinning"}>
            <Icon name="spin" />
            {phase === "spinning" ? "Spinning…" : !ready && !error ? "Loading recipes…" : phase === "landed" ? "Spin again" : "Surprise me"}
          </button>
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-missing bg-missing-soft px-4 py-3 text-sm text-missing">
              <span>{error}</span>
              <button type="button" className="btn btn-secondary min-h-9 px-3 py-1 text-sm" onClick={retry}>
                Retry
              </button>
            </div>
          )}
          {ready && (
            <p className="text-center text-sm text-muted">
              {empty ? "No dishes match these filters." : `${pool!.length.toLocaleString()} dishes can land on the wheel${activeFilterCount ? " with your filters" : ""}.`}
            </p>
          )}
        </div>

        <WheelFilters
          filters={filters}
          onChange={updateFilters}
          categories={categories}
          countries={countries}
          activeCount={activeFilterCount}
          discovery={discovery}
          disabled={!ready}
        />
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <section ref={resultRef} aria-label="Wheel result" className="lg:sticky lg:top-24">
        {result && phase === "landed" ? (
          <ResultCard
            key={result.id}
            recipe={result}
            repeated={repeated}
            saved={isSaved(result.id)}
            onSave={() =>
              toggle({ id: result.id, slug: result.slug, title: result.title, imageUrl: result.imageUrl, country: result.country })
            }
            onSpin={spin}
          />
        ) : empty ? (
          <div className="card flex flex-col items-start gap-3 p-6">
            <h2 className="text-2xl font-semibold">Nothing on the menu</h2>
            <p className="text-muted">No dish in the catalogue matches every filter you chose. Loosen one and try again.</p>
            <button type="button" className="btn btn-secondary" onClick={() => updateFilters({})}>
              Clear all filters
            </button>
          </div>
        ) : (
          <WaitingCard spinning={phase === "spinning"} />
        )}
      </section>
    </div>
  );
}

function WaitingCard({ spinning }: { spinning: boolean }) {
  return (
    <div className="card relative overflow-hidden p-6 sm:p-8">
      <p className="eyebrow">{spinning ? "Choosing…" : "How it works"}</p>
      <h2 className="mt-2 text-3xl font-semibold">{spinning ? "Round and round it goes." : "One spin, one real recipe."}</h2>
      <ol className="mt-5 space-y-3 text-muted">
        <li className="flex gap-3">
          <span className="font-display text-lg font-semibold text-accent">1</span>
          <span>Set filters if you like: no meat or fish, a category, a country, or ingredients to skip.</span>
        </li>
        <li className="flex gap-3">
          <span className="font-display text-lg font-semibold text-accent">2</span>
          <span>Spin. A dish is picked at random from every matching recipe, not just the ten on the plate, and you won’t see repeats until you’ve been through them all.</span>
        </li>
        <li className="flex gap-3">
          <span className="font-display text-lg font-semibold text-accent">3</span>
          <span>Open it for the ingredients, method, video and original source.</span>
        </li>
      </ol>
    </div>
  );
}

function ResultCard({
  recipe,
  repeated,
  saved,
  onSave,
  onSpin,
}: {
  recipe: RecipeSummary;
  repeated: boolean;
  saved: boolean;
  onSave: () => void;
  onSpin: () => void;
}) {
  const img = imageVariant(recipe.imageUrl, "large");
  const count = recipe.req.length + recipe.opt.length;
  return (
    <article className="card reveal overflow-hidden" data-recipe-id={recipe.id}>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={recipe.title} width={350} height={350} className="aspect-[4/3] w-full object-cover" />
      )}
      <div className="p-6">
        <p className="eyebrow">The wheel picked</p>
        <h2 className="mt-1.5 text-3xl font-semibold sm:text-4xl">{recipe.title}</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {recipe.country && (
            <li className="chip">
              <Icon name="globe" size={14} />
              {recipe.country}
            </li>
          )}
          {recipe.category && <li className="chip">{recipe.category}</li>}
          <li className="chip">{count} ingredients</li>
          {recipe.hasVideo && (
            <li className="chip">
              <Icon name="video" size={14} />
              Video
            </li>
          )}
        </ul>
        {repeated && (
          <p className="mt-3 text-sm text-muted">You’ve seen every dish that matches your filters, so the oldest one is back.</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href={recipePath(recipe.slug)} className="btn btn-primary">
            View full recipe
            <Icon name="arrowRight" size={18} />
          </Link>
          <button type="button" className="btn btn-secondary" onClick={onSave} aria-pressed={saved}>
            <Icon name="heart" size={18} filled={saved} className={saved ? "text-accent" : undefined} />
            {saved ? "Saved" : "Save"}
          </button>
          <YouTubeButton title={recipe.title} />
          <button type="button" className="btn btn-ghost" onClick={onSpin}>
            <Icon name="spin" size={18} />
            Spin again
          </button>
        </div>
      </div>
    </article>
  );
}

function WheelFilters({
  filters,
  onChange,
  categories,
  countries,
  activeCount,
  discovery,
  disabled,
}: {
  filters: DiscoveryFilters;
  onChange: (f: DiscoveryFilters) => void;
  categories: string[];
  countries: string[];
  activeCount: number;
  discovery: ReturnType<typeof useDiscovery>["discovery"];
  disabled: boolean;
}) {
  const excluded = filters.excludedIngredientIds ?? [];
  return (
    <details className="card group w-full max-w-[460px] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.25rem] px-5 py-3 font-semibold">
        <span className="flex items-center gap-2">
          <Icon name="filter" size={18} />
          Filters
          {activeCount > 0 && <span className="rounded-full bg-ink px-2 text-xs text-bg">{activeCount}</span>}
        </span>
        <Icon name="plus" size={18} className="transition-transform group-open:rotate-45" />
      </summary>
      <div className="space-y-5 border-t border-line px-5 pt-4 pb-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[var(--herb)]"
            checked={!!filters.meatFree}
            disabled={disabled}
            onChange={(e) => onChange({ ...filters, meatFree: e.target.checked || undefined })}
          />
          <span>
            <span className="font-semibold">No meat or fish listed</span>
            <span className="block text-sm text-muted">Checked against each recipe’s ingredient list, not its label. Always read the ingredients yourself.</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Category</span>
            <select
              className="field"
              disabled={disabled}
              value={filters.categories?.[0] ?? ""}
              onChange={(e) => onChange({ ...filters, categories: e.target.value ? [e.target.value] : undefined })}
            >
              <option value="">Any category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Country</span>
            <select
              className="field"
              disabled={disabled}
              value={filters.countries?.[0] ?? ""}
              onChange={(e) => onChange({ ...filters, countries: e.target.value ? [e.target.value] : undefined })}
            >
              <option value="">Anywhere</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {discovery && (
          <div>
            <IngredientCombobox
              label="Leave out ingredients"
              placeholder="e.g. peanuts, mushrooms"
              ingredients={discovery.index.ingredients}
              aliases={discovery.index.aliases}
              exclude={excluded}
              onPick={(ing) => onChange({ ...filters, excludedIngredientIds: [...excluded, ing.id] })}
            />
            {excluded.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Left out">
                {excluded.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="chip chip-missing min-h-9"
                      onClick={() => onChange({ ...filters, excludedIngredientIds: excluded.filter((x) => x !== id) })}
                    >
                      {discovery.ingredientById.get(id)?.name ?? id}
                      <Icon name="close" size={14} />
                      <span className="sr-only">(remove)</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              Hides recipes that list these ingredients. This is not an allergy filter: recipe data can be incomplete.
            </p>
          </div>
        )}

        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost -ml-3 text-sm" onClick={() => onChange({})}>
            Clear filters
          </button>
        )}
      </div>
    </details>
  );
}
