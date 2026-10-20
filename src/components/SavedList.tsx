"use client";

import Link from "next/link";
import { useHydrated, useSavedRecipes } from "@/lib/storage";
import { Icon } from "./Icon";
import { RecipeCard } from "./RecipeCard";

export function SavedList() {
  const { saved, remove } = useSavedRecipes();
  const mounted = useHydrated();

  if (!mounted) return <div className="card h-40 animate-pulse bg-surface-2" aria-hidden="true" />;

  if (saved.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-4 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Nothing saved yet</h2>
        <p className="text-muted">Spin the wheel or search by ingredient, then tap Save on anything you’d like to cook later.</p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/" className="btn btn-primary">
            <Icon name="spin" size={18} />
            Spin the wheel
          </Link>
          <Link href="/cook/" className="btn btn-secondary">
            Cook with what I have
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {saved.map((s) => (
        <li key={s.id}>
          <RecipeCard recipe={{ slug: s.slug, title: s.title, imageUrl: s.imageUrl, country: s.country, category: null }}>
            <button type="button" className="btn btn-ghost -ml-3 min-h-10 text-sm text-muted" onClick={() => remove(s.id)}>
              <Icon name="close" size={16} />
              Remove<span className="sr-only"> {s.title}</span>
            </button>
          </RecipeCard>
        </li>
      ))}
    </ul>
  );
}
