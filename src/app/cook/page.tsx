import type { Metadata } from "next";
import { PreloadDiscovery } from "@/components/PreloadDiscovery";
import { CookFinder } from "@/components/CookFinder";
import { getPopularIngredients } from "@/lib/catalog";
import { PANTRY_STAPLES } from "@/lib/discovery/matching";

export const metadata: Metadata = {
  title: "Cook with what you have",
  description: "Pick the ingredients in your kitchen and find recipes you can make now, or with just a few extra things.",
};

export default function CookPage() {
  const popular = getPopularIngredients(24, PANTRY_STAPLES);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <PreloadDiscovery />
      <p className="eyebrow">Ingredient finder</p>
      <h1 className="mt-2 text-[clamp(2.2rem,6vw,3.6rem)] font-semibold">What’s in your kitchen?</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Add what you have. We’ll show recipes that use it, with what you have and what you’d still need listed separately.
      </p>
      <div className="mt-8">
        <CookFinder popular={popular} />
      </div>
    </div>
  );
}
