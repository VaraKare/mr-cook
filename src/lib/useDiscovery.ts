"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildGraph, type IngredientGraph } from "./discovery/graph";
import { asset } from "./site";
import type { DiscoveryIndex, Ingredient } from "./types";

export interface Discovery {
  index: DiscoveryIndex;
  graph: IngredientGraph;
  ingredientById: Map<string, Ingredient>;
}

let pending: Promise<DiscoveryIndex> | null = null;

function load(): Promise<DiscoveryIndex> {
  if (!pending) {
    pending = fetch(asset("/data/discovery.json"), { cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DiscoveryIndex>;
      })
      .catch((error) => {
        pending = null; // allow retry
        throw error;
      });
  }
  return pending;
}

/** Loads the shared recipe index once per page session. */
export function useDiscovery() {
  const [index, setIndex] = useState<DiscoveryIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setIndex(data))
      .catch(() => !cancelled && setError("We couldn't load the recipe catalogue. Check your connection and try again."));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const discovery = useMemo<Discovery | null>(() => {
    if (!index) return null;
    return {
      index,
      graph: buildGraph(index.ingredients),
      ingredientById: new Map(index.ingredients.map((i) => [i.id, i])),
    };
  }, [index]);

  return { discovery, error, retry };
}
