"use client";

import { useSavedRecipes, type SavedRecipe } from "@/lib/storage";
import { Icon } from "./Icon";

export function SaveButton({ recipe, className = "btn btn-secondary" }: { recipe: Omit<SavedRecipe, "savedAt">; className?: string }) {
  const { isSaved, toggle } = useSavedRecipes();
  const saved = isSaved(recipe.id);
  return (
    <button type="button" className={className} aria-pressed={saved} onClick={() => toggle(recipe)}>
      <Icon name="heart" size={18} filled={saved} className={saved ? "text-accent" : undefined} />
      {saved ? "Saved" : "Save recipe"}
    </button>
  );
}
