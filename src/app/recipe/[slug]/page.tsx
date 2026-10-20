import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { IngredientChecklist } from "@/components/IngredientChecklist";
import { RecipeCard } from "@/components/RecipeCard";
import { SaveButton } from "@/components/SaveButton";
import { VideoEmbed } from "@/components/VideoEmbed";
import { getCatalog, getRecipeBySlug, getRelated } from "@/lib/catalog";
import { imageVariant, youtubeSearchUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalog().recipes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/recipe/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) return {};
  const where = recipe.country ? ` from ${recipe.country}` : "";
  const description = `${recipe.title}${where}: ${recipe.ingredients.length} ingredients and step-by-step method${recipe.videos.length ? ", with a cooking video" : ""}.`;
  return {
    title: recipe.title,
    description,
    openGraph: { title: recipe.title, description, images: recipe.imageUrl ? [{ url: recipe.imageUrl, width: 700, height: 700 }] : [] },
  };
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className={`mt-0.5 truncate ${value ? "font-semibold" : "text-muted"}`}>{value ?? "Not provided"}</dd>
    </div>
  );
}

export default async function RecipePage({ params }: PageProps<"/recipe/[slug]">) {
  const { slug } = await params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) notFound();

  const videos = recipe.videos.filter((v) => v.status !== "unavailable");
  const related = getRelated(recipe);
  const hero = imageVariant(recipe.imageUrl, "full");

  // Structured data only describes what is visible on this page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    image: recipe.imageUrl ? [recipe.imageUrl] : undefined,
    recipeCuisine: recipe.cuisine ?? recipe.country ?? undefined,
    recipeCategory: recipe.category ?? undefined,
    keywords: recipe.tags.length ? recipe.tags.join(", ") : undefined,
    recipeIngredient: recipe.ingredients.map((i) => [i.measure, i.sourceName].filter(Boolean).join(" ")),
    recipeInstructions: recipe.instructions.map((text) => ({ "@type": "HowToStep", text })),
    isBasedOn: recipe.source.originalUrl ?? recipe.source.providerUrl,
    video: videos[0]
      ? {
          "@type": "VideoObject",
          name: videos[0].title ?? recipe.title,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videos[0].youtubeId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${videos[0].youtubeId}/hqdefault.jpg`,
          contentUrl: videos[0].url,
        }
      : undefined,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-ink">Spin</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-ink">{recipe.title}</li>
          </ol>
        </nav>

        <header className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center lg:gap-12">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt={recipe.title}
              width={700}
              height={700}
              fetchPriority="high"
              className="aspect-square w-full rounded-[1.75rem] object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-[1.75rem] bg-surface-2 text-muted">No photo provided</div>
          )}
          <div>
            <p className="eyebrow">{[recipe.category, recipe.cuisine && recipe.cuisine !== recipe.country ? `${recipe.cuisine} cuisine` : null].filter(Boolean).join(" · ") || "Recipe"}</p>
            <h1 className="mt-2 text-[clamp(2.2rem,5.5vw,3.8rem)] font-semibold">{recipe.title}</h1>
            {recipe.alternateTitle && <p className="mt-2 text-lg text-muted">Also known as {recipe.alternateTitle}</p>}

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-3">
              <Fact label="Country" value={recipe.country} />
              <Fact label="Ingredients" value={String(recipe.ingredients.length)} />
              <Fact label="Steps" value={recipe.instructions.length ? String(recipe.instructions.length) : null} />
              <Fact label="Total time" value={recipe.totalMinutes ? `${recipe.totalMinutes} min` : null} />
              <Fact label="Serves" value={recipe.servings ? String(recipe.servings) : null} />
              <Fact label="Difficulty" value={recipe.difficulty} />
            </dl>
            {recipe.totalMinutes === null && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
                <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                The source doesn’t list times, servings or difficulty, so we don’t estimate them.
              </p>
            )}

            {recipe.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
                {recipe.tags.map((t) => (
                  <li key={t} className="chip">{t}</li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex flex-wrap gap-2.5">
              <SaveButton recipe={{ id: recipe.id, slug: recipe.slug, title: recipe.title, imageUrl: recipe.imageUrl, country: recipe.country }} />
              <Link href="/?spin=1" className="btn btn-primary">
                <Icon name="spin" size={18} />
                Spin another
              </Link>
            </div>
          </div>
        </header>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <section aria-labelledby="ingredients-heading" className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="ingredients-heading" className="text-3xl font-semibold">Ingredients</h2>
          <p className="mt-1 text-sm text-muted">Amounts exactly as the source lists them. Tick them off as you go.</p>
          <div className="mt-4">
            <IngredientChecklist items={recipe.ingredients} />
          </div>
        </section>

        <div className="space-y-12">
          <section aria-labelledby="method-heading">
            <h2 id="method-heading" className="text-3xl font-semibold">Method</h2>
            {recipe.instructions.length ? (
              <ol className="prose-steps mt-5 list-decimal space-y-4 pl-6 text-[1.0625rem] leading-relaxed marker:text-lg">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="pl-2">{step}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-muted">The source didn’t include instructions for this recipe.</p>
            )}
          </section>

          <section aria-labelledby="video-heading">
            <h2 id="video-heading" className="text-3xl font-semibold">Watch it made</h2>
            <div className="mt-5 space-y-6">
              {videos.map((v) => (
                <VideoEmbed key={v.youtubeId} video={v} recipeTitle={recipe.title} />
              ))}
              {videos.length === 0 && (
                <p className="text-muted">
                  {recipe.videos.length ? "The video the source linked is no longer available." : "The source doesn’t link a video for this recipe."}
                </p>
              )}
              <a
                href={youtubeSearchUrl(recipe.title)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:underline"
              >
                Search YouTube for more “{recipe.title}” videos
                <Icon name="external" size={14} />
              </a>
            </div>
          </section>

          <section aria-labelledby="source-heading" className="rounded-2xl border border-line bg-surface p-6">
            <h2 id="source-heading" className="text-2xl font-semibold">Source and credit</h2>
            <ul className="mt-3 space-y-2 text-[0.9375rem]">
              {recipe.source.originalUrl && (
                <li>
                  <a href={recipe.source.originalUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:underline">
                    Original recipe ({new URL(recipe.source.originalUrl).hostname.replace(/^www\./, "")})
                    <Icon name="external" size={14} />
                  </a>
                </li>
              )}
              <li>
                <a href={recipe.source.providerUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                  This recipe on TheMealDB (#{recipe.source.recipeId})
                  <Icon name="external" size={14} />
                </a>
              </li>
            </ul>
            <p className="mt-3 text-sm text-muted">{recipe.source.attribution}. Photo is user-contributed artwork hosted by TheMealDB.</p>
            <p className="mt-2 text-sm text-muted">
              Not verified by Mr. Cook. Check every ingredient label for allergens and dietary needs.
            </p>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
          <h2 id="related-heading" className="text-3xl font-semibold">
            {recipe.country && related.some((r) => r.country === recipe.country) ? `More from ${recipe.country}` : "You might also like"}
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
