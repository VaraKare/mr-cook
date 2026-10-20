"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DiscoveryFilters } from "./discovery/filters";

/*
 * Per-browser storage only. Nothing here leaves the device. Every access is
 * wrapped because storage can be unavailable (private mode, blocked cookies).
 */

const KEYS = {
  saved: "mrcook:saved:v1",
  recent: "mrcook:recent:v1",
  filters: "mrcook:filters:v1",
  pantry: "mrcook:pantry:v1",
} as const;

export interface SavedRecipe {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  country: string | null;
  savedAt: string;
}

const EVENT = "mrcook:storage";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the feature degrades to this session only.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(callback: () => void) {
  const onStorage = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onStorage);
  };
}

// useSyncExternalStore needs referentially stable snapshots.
const snapshotCache = new Map<string, { raw: string | null; value: unknown }>();
function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = snapshotCache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try {
    value = raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    value = fallback;
  }
  snapshotCache.set(key, { raw, value });
  return value;
}

const EMPTY: SavedRecipe[] = [];

export function useSavedRecipes() {
  const saved = useSyncExternalStore(
    subscribe,
    () => snapshot<SavedRecipe[]>(KEYS.saved, EMPTY),
    () => EMPTY,
  );
  const isSaved = useCallback((id: string) => saved.some((s) => s.id === id), [saved]);
  const toggle = useCallback((recipe: Omit<SavedRecipe, "savedAt">) => {
    const current = read<SavedRecipe[]>(KEYS.saved, []);
    const next = current.some((s) => s.id === recipe.id)
      ? current.filter((s) => s.id !== recipe.id)
      : [{ ...recipe, savedAt: new Date().toISOString() }, ...current];
    write(KEYS.saved, next.slice(0, 500));
  }, []);
  const remove = useCallback((id: string) => {
    write(KEYS.saved, read<SavedRecipe[]>(KEYS.saved, []).filter((s) => s.id !== id));
  }, []);
  return { saved, isSaved, toggle, remove };
}

export function readRecent(): string[] {
  return read<string[]>(KEYS.recent, []);
}
export function writeRecent(ids: string[]) {
  write(KEYS.recent, ids);
}

const NO_FILTERS: DiscoveryFilters = {};

/** Wheel filters persisted per browser. Server render uses "no filters". */
export function useStoredFilters(): [DiscoveryFilters, (f: DiscoveryFilters) => void] {
  const filters = useSyncExternalStore(
    subscribe,
    () => snapshot<DiscoveryFilters>(KEYS.filters, NO_FILTERS),
    () => NO_FILTERS,
  );
  const set = useCallback((f: DiscoveryFilters) => write(KEYS.filters, f), []);
  return [filters, set];
}

/** "I have the basics" toggle, default on. */
export function useStoredPantry(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot<boolean>(KEYS.pantry, true),
    () => true,
  );
  const set = useCallback((v: boolean) => write(KEYS.pantry, v), []);
  return [value, set];
}

const noopSubscribe = () => () => {};

/** False during the server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function subscribeLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

/** The current query string; empty on the server (static export). */
export function useLocationSearch(): string {
  return useSyncExternalStore(subscribeLocation, () => window.location.search, () => "");
}
