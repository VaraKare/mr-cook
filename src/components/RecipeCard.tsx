import Link from "next/link";
import type { ReactNode } from "react";
import { imageVariant, recipePath } from "@/lib/site";
import type { RecipeSummary } from "@/lib/types";

export function RecipeCard({ recipe, children }: { recipe: Pick<RecipeSummary, "slug" | "title" | "imageUrl" | "country" | "category">; children?: ReactNode }) {
  const img = imageVariant(recipe.imageUrl, "large");
  return (
    <div className="card group flex h-full flex-col overflow-hidden transition-colors hover:border-line-strong">
      <Link href={recipePath(recipe.slug)} className="flex flex-1 flex-col">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" width={350} height={350} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="aspect-[4/3] w-full bg-surface-2" />
        )}
        <div className="flex-1 p-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {[recipe.country, recipe.category].filter(Boolean).join(" · ")}
          </p>
          <h3 className="mt-1 text-lg leading-snug font-semibold group-hover:text-accent">{recipe.title}</h3>
        </div>
      </Link>
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
