"use client";

import { useEffect, useMemo, useState } from "react";
import { matchRecipes, PANTRY_STAPLES, type MatchMode, type MatchResult } from "@/lib/discovery/matching";
import { useLocationSearch, useStoredPantry } from "@/lib/storage";
import type { Ingredient } from "@/lib/types";
import { useDiscovery } from "@/lib/useDiscovery";
import { Icon } from "./Icon";
import { IngredientCombobox, IngredientThumb } from "./IngredientCombobox";
import { RecipeCard } from "./RecipeCard";
import { YouTubeButton } from "./YouTubeButton";

const PAGE = 24;
const SUGGESTIONS: { label: string; ids: string[] }[] = [
  { label: "Chicken, rice, garlic, onion", ids: ["chicken", "rice", "garlic", "onion"] },
  { label: "Eggs, milk, flour, butter", ids: ["egg", "milk", "flour", "butter"] },
  { label: "Potato, onion, cheese", ids: ["potato", "onion", "cheddar-cheese"] },
  { label: "Pasta, tomato, garlic", ids: ["spaghetti", "tomato", "garlic"] },
];
const ID_PATTERN = /^[a-z0-9-]{1,60}$/;

function parseUrlState(search: string) {
  const params = new URLSearchParams(search);
  const have = (params.get("have") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ID_PATTERN.test(s))
    .slice(0, 30);
  const mode: MatchMode = params.get("mode") === "buy" ? "buy" : "have";
  const missing = Math.max(1, Math.min(5, Number(params.get("missing")) || 2));
  return { have, mode, missing };
}

export function CookFinder({ popular }: { popular: Ingredient[] }) {
  const { discovery, error, retry } = useDiscovery();
  const search = useLocationSearch();
  const fromUrl = useMemo(() => parseUrlState(search), [search]);
  // null = "not touched yet": fall back to what the URL asked for.
  const [selectedState, setSelected] = useState<string[] | null>(null);
  const [modeState, setMode] = useState<MatchMode | null>(null);
  const [missingState, setMaxMissing] = useState<number | null>(null);
  const [assumePantry, setAssumePantry] = useStoredPantry();
  const [meatFree, setMeatFree] = useState(false);
  const [category, setCategory] = useState("");

  const rawSelected = selectedState ?? fromUrl.have;
  // Ignore ids that aren't in the catalogue (e.g. a hand-edited URL).
  const selected = useMemo(
    () => (discovery ? rawSelected.filter((id) => discovery.ingredientById.has(id)) : rawSelected),
    [discovery, rawSelected],
  );
  const mode = modeState ?? fromUrl.mode;
  const maxMissing = missingState ?? fromUrl.missing;

  // Keep the URL shareable without adding history entries.
  const touched = selectedState !== null || modeState !== null || missingState !== null;
  useEffect(() => {
    if (!touched) return;
    const params = new URLSearchParams();
    if (selected.length) params.set("have", selected.join(","));
    if (mode === "buy") {
      params.set("mode", "buy");
      params.set("missing", String(maxMissing));
    }
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [selected, mode, maxMissing, touched]);

  // "Show more" resets whenever the query changes.
  const queryKey = [selected.join(","), mode, maxMissing, assumePantry, meatFree, category].join("|");
  const [paging, setPaging] = useState({ key: queryKey, shown: PAGE });
  const shown = paging.key === queryKey ? paging.shown : PAGE;
  const showMore = () => setPaging({ key: queryKey, shown: shown + PAGE });

  const response = useMemo(() => {
    if (!discovery) return null;
    return matchRecipes(
      discovery.index.recipes,
      selected,
      { mode, maxMissing, assumePantry, limit: 500, filters: { meatFree: meatFree || undefined, categories: category ? [category] : undefined } },
      discovery.graph,
    );
  }, [discovery, selected, mode, maxMissing, assumePantry, meatFree, category]);

  const categories = useMemo(
    () => [...new Set(discovery?.index.recipes.map((r) => r.category).filter((c): c is string => !!c))].sort(),
    [discovery],
  );

  const add = (id: string) => setSelected(selected.includes(id) ? selected : [...selected, id]);
  const remove = (id: string) => setSelected(selected.filter((x) => x !== id));
  const toggle = (id: string) => (selected.includes(id) ? remove(id) : add(id));
  const nameOf = (id: string) => discovery?.ingredientById.get(id)?.name ?? popular.find((p) => p.id === id)?.name ?? id;
  const pantryNames = PANTRY_STAPLES.filter((id) => !discovery || discovery.ingredientById.has(id)).map(nameOf);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
      {/* Controls. On phones, results come before the popular tiles. */}
      <div className="card space-y-5 self-start p-5 lg:col-start-1">
          <IngredientCombobox
            label="Add an ingredient"
            ingredients={discovery?.index.ingredients ?? popular}
            aliases={discovery?.index.aliases ?? {}}
            exclude={selected}
            onPick={(ing) => add(ing.id)}
            disabled={!!error}
          />

          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">In your kitchen {selected.length > 0 && <span className="text-muted">({selected.length})</span>}</h2>
              {selected.length > 0 && (
                <button type="button" className="text-sm font-semibold text-accent underline-offset-4 hover:underline" onClick={() => setSelected([])}>
                  Clear all
                </button>
              )}
            </div>
            {selected.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing yet. Search above or tap the ingredients below.</p>
            ) : (
              <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Selected ingredients">
                {selected.map((id) => (
                  <li key={id}>
                    <button type="button" className="chip chip-have min-h-9 pr-2" onClick={() => remove(id)}>
                      {nameOf(id)}
                      <Icon name="close" size={14} />
                      <span className="sr-only">(remove)</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">How strict?</legend>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="radiogroup">
              {(
                [
                  ["have", "Use what I have"],
                  ["buy", "I can buy a few"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center justify-center rounded-full px-3 text-center text-sm font-semibold text-muted has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]"
                >
                  <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">
              {mode === "have" ? "Only recipes where you have every required ingredient." : "Recipes may need a few things you don’t have yet."}
            </p>
            {mode === "buy" && (
              <label className="mt-3 block">
                <span className="flex items-baseline justify-between text-sm font-semibold">
                  Up to {maxMissing} missing {maxMissing === 1 ? "ingredient" : "ingredients"}
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={maxMissing}
                  onChange={(e) => setMaxMissing(Number(e.target.value))}
                  className="mt-2 w-full accent-[var(--accent)]"
                  aria-valuetext={`${maxMissing} missing`}
                />
              </label>
            )}
          </fieldset>

          <div className="space-y-3 border-t border-line pt-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--herb)]"
                checked={assumePantry}
                onChange={(e) => setAssumePantry(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-semibold">I have the basics</span>
                <span className="block text-muted">{pantryNames.join(", ")}</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--herb)]" checked={meatFree} onChange={(e) => setMeatFree(e.target.checked)} />
              <span className="text-sm">
                <span className="font-semibold">No meat or fish listed</span>
                <span className="block text-muted">Based on the ingredient list. Not a dietary guarantee.</span>
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Category</span>
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!discovery}>
                <option value="">Any category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
      </div>

      {/* Results */}
      <section
        aria-labelledby="results-heading"
        aria-busy={!discovery && !error}
        className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div aria-live="polite">
          <h2 id="results-heading" className="text-2xl font-semibold sm:text-3xl">
            {!discovery
              ? error
                ? "Couldn’t load recipes"
                : "Loading recipes…"
              : selected.length === 0
                ? "Add ingredients to see recipes"
                : response!.totalMatches === 0
                  ? mode === "have"
                    ? "Nothing you can make with just these yet"
                    : "No recipes within that shopping list"
                  : `${response!.totalMatches} ${response!.totalMatches === 1 ? "recipe" : "recipes"} ${mode === "have" ? "you can make now" : `with up to ${maxMissing} to buy`}`}
          </h2>
        </div>

        {error && (
          <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-missing bg-missing-soft px-4 py-3 text-sm text-missing">
            <span>{error}</span>
            <button type="button" className="btn btn-secondary min-h-9 px-3 py-1 text-sm" onClick={retry}>Retry</button>
          </div>
        )}

        {!discovery && !error && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="card h-72 animate-pulse bg-surface-2" />
            ))}
          </ul>
        )}

        {discovery && selected.length === 0 && (
          <div className="mt-6 card p-6">
            <p className="text-muted">Not sure where to start? Try one of these:</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.filter((s) => s.ids.every((id) => discovery.ingredientById.has(id))).map((s) => (
                <li key={s.label}>
                  <button type="button" className="btn btn-secondary text-sm" onClick={() => setSelected(s.ids)}>{s.label}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {discovery && response && selected.length > 0 && (
          <>
            {response.totalMatches === 0 && (
              <p className="mt-3 text-muted">
                {mode === "have"
                  ? "Add a few more ingredients, or switch to “I can buy a few” to allow a short shopping list."
                  : "Try allowing more missing ingredients or removing a filter."}
              </p>
            )}
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {response.results.slice(0, shown).map((m) => (
                <li key={m.recipe.id}>
                  <MatchCard match={m} nameOf={nameOf} selectedCount={selected.length} />
                </li>
              ))}
            </ul>
            {response.results.length > shown && (
              <button type="button" className="btn btn-secondary mt-6 w-full" onClick={showMore}>
                Show more ({response.results.length - shown} left)
              </button>
            )}

            {response.nearMisses.length > 0 && (
              <div className="mt-12">
                <h2 className="text-2xl font-semibold">Almost there</h2>
                <p className="mt-1 text-muted">You’re missing one or two things for these.</p>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                  {response.nearMisses.map((m) => (
                    <li key={m.recipe.id}>
                      <MatchCard match={m} nameOf={nameOf} selectedCount={selected.length} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <div className="lg:col-start-1">
          <h2 className="mb-3 text-sm font-semibold">Popular ingredients</h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
            {popular.map((ing) => {
              const on = selected.includes(ing.id);
              return (
                <li key={ing.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(ing.id)}
                    className="relative flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface p-2 text-center text-[0.8125rem] font-medium transition-colors hover:border-ink aria-pressed:border-herb aria-pressed:bg-herb-soft aria-pressed:text-herb"
                  >
                    {on && <Icon name="check" size={16} className="absolute top-1.5 right-1.5" />}
                    <IngredientThumb ingredient={ing} size={40} />
                    <span className="leading-tight">{ing.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
      </div>
    </div>
  );
}

function MatchCard({ match, nameOf, selectedCount }: { match: MatchResult; nameOf: (id: string) => string; selectedCount: number }) {
  const missing = match.missingRequired.length;
  return (
    <RecipeCard recipe={match.recipe}>
      <p className={`text-sm font-semibold ${match.cookable ? "text-herb" : "text-missing"}`}>
        {match.cookable ? "You have everything required" : `Need ${missing} more ${missing === 1 ? "ingredient" : "ingredients"}`}
        <span className="font-normal text-muted"> · uses {match.selectedUsed} of your {selectedCount}</span>
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        {match.missingRequired.length > 0 && (
          <div>
            <dt className="sr-only">Missing</dt>
            <dd className="flex flex-wrap gap-1.5">
              {match.missingRequired.map((id) => (
                <span key={id} className="chip chip-missing">
                  <span aria-hidden="true">+</span> {nameOf(id)}
                  <span className="sr-only">(missing)</span>
                </span>
              ))}
            </dd>
          </div>
        )}
        <div>
          <dt className="sr-only">You have</dt>
          <dd className="flex flex-wrap gap-1.5">
            {match.have.map((id) => (
              <span key={id} className="chip chip-have">
                <Icon name="check" size={12} /> {nameOf(id)}
              </span>
            ))}
            {match.pantry.map((id) => (
              <span key={id} className="chip chip-pantry" title="Assumed from your basics">
                {nameOf(id)}
              </span>
            ))}
          </dd>
        </div>
        {match.missingOptional.length > 0 && (
          <div>
            <dt className="text-xs text-muted">Optional, not selected:</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {match.missingOptional.map((id) => (
                <span key={id} className="chip chip-optional">{nameOf(id)}</span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-4">
        <YouTubeButton title={match.recipe.title} compact />
      </div>
    </RecipeCard>
  );
}
