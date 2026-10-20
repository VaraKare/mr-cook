import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getStats } from "@/lib/catalog";
import { PANTRY_STAPLES } from "@/lib/discovery/matching";

export const metadata: Metadata = {
  title: "About the data",
  description: "Where Mr. Cook's recipes come from, how the wheel and ingredient matching work, and what we don't know.",
};

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="scroll-mt-24 border-t border-line pt-8">
      <h2 id={`${id ?? title}-h`} className="text-3xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4 text-[1.0625rem] text-muted [&_strong]:text-ink">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  const catalog = getCatalog();
  const stats = getStats();
  const generated = new Date(catalog.generatedAt);
  const unavailableVideos = catalog.recipes.filter((r) => r.videos.some((v) => v.status === "unavailable")).length;
  const vegLabelled = catalog.recipes.filter((r) => r.category === "Vegetarian" || r.category === "Vegan");
  const vegLabelledWithAnimal = vegLabelled.filter((r) => !r.meatFree).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <p className="eyebrow">About the data</p>
      <h1 className="mt-2 text-[clamp(2.2rem,6vw,3.6rem)] font-semibold">What’s on the plate, and what isn’t</h1>
      <p className="mt-4 text-lg text-muted">
        Mr. Cook helps you decide what to cook. The recipe information is copied from its source, never made up, and
        anything the source doesn’t provide is shown as not provided.
      </p>

      <div className="mt-10 space-y-10">
        <Section id="source" title="Where the recipes come from">
          <p>
            All <strong>{stats.recipes.toLocaleString()} recipes</strong> from <strong>{stats.countries} countries</strong> come from{" "}
            <a className="font-semibold text-accent underline underline-offset-4" href="https://www.themealdb.com/" target="_blank" rel="noopener">TheMealDB</a>,
            a crowd-sourced recipe database with an open JSON API. TheMealDB’s terms allow copying content returned by
            the API, ask that it be credited as the source, and prohibit scraping its website. We use only the official
            API. Photos are user-contributed artwork hosted by TheMealDB. Where a recipe credits an original website, we
            link to it.
          </p>
          <p>
            The catalogue was last refreshed on <strong>{generated.toUTCString().slice(5, 16)}</strong>. It’s refreshed
            automatically every week by re-running the importer.
          </p>
        </Section>

        <Section title="What we don’t know">
          <p>
            TheMealDB doesn’t publish <strong>cooking times, servings or difficulty</strong>, so recipe pages show these as
            “Not provided”, and there’s no time filter yet. We won’t estimate them. Ingredient amounts are shown exactly as
            written by the source.
          </p>
          <p>
            Country of origin comes from TheMealDB’s own <code>country</code> field. Food history is often contested, so
            treat it as the source’s label, not a definitive origin.
          </p>
        </Section>

        <Section id="dietary" title="Dietary and allergy information">
          <p>
            The “No meat or fish listed” filter checks every ingredient in a recipe against a list of meat and seafood
            terms. We don’t rely on the category label, because it isn’t reliable: <strong>{vegLabelledWithAnimal} of {vegLabelled.length}</strong> recipes
            labelled Vegetarian or Vegan in the source list an ingredient such as chicken stock, bacon or fish sauce.
          </p>
          <p>
            <strong>Nothing on this site is an allergy or dietary guarantee.</strong> Recipe data can be incomplete, and
            packaged ingredients can contain hidden allergens. Always read the full ingredient list and product labels.
          </p>
        </Section>

        <Section id="wheel" title="How the wheel picks">
          <p>
            When you spin, a recipe is chosen <strong>first</strong>, uniformly at random from every recipe that matches
            your filters and has a photo. That includes the whole catalogue, not just the ten dishes on the plate. The
            wheel is then turned so it lands exactly on that dish. The animation can’t change the result.
          </p>
          <p>
            Your browser keeps a list of the last 40 dishes you were shown and skips them while there are others to choose
            from. When every matching dish has been shown, the one you saw longest ago comes back first.
          </p>
        </Section>

        <Section id="matching" title="How ingredient matching works">
          <p>
            Ingredient names are normalised, so <strong>cilantro</strong> and <strong>coriander</strong>,{" "}
            <strong>scallions</strong> and <strong>spring onions</strong>, or <strong>eggs</strong> and <strong>egg</strong> count as
            the same thing. Some ingredients are grouped into families: “chicken” covers chicken thighs and breast, but
            chicken thighs don’t stand in for chicken breast.
          </p>
          <p>For every recipe we count:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>Have</strong>: ingredients you selected.</li>
            <li><strong>Basics</strong>: {PANTRY_STAPLES.join(", ").replace(/-/g, " ")}. These are assumed only while “I have the basics” is on.</li>
            <li><strong>Missing</strong>: required ingredients you don’t have.</li>
            <li><strong>Optional</strong>: ingredients the source marks for garnish, serving or as optional.</li>
          </ul>
          <p>
            <strong>Use what I have</strong> shows only recipes with nothing required missing, ranked by how many of your
            ingredients they use. <strong>I can buy a few</strong> allows 1–5 missing ingredients and ranks by “ingredients of
            yours used minus ingredients to buy”, so using two of yours offsets buying two. Ties go to the shorter shopping
            list. A recipe with anything required missing is never shown as ready to cook.
          </p>
        </Section>

        <Section id="videos" title="Videos">
          <p>
            Videos are the ones the recipe source links to. We check each link with YouTube’s public oEmbed endpoint when
            the catalogue is refreshed, and links checked more than 30 days ago are checked again. {stats.withVideo} recipes currently have a
            working video and {unavailableVideos} linked videos are hidden because they’re no longer available. We never make up video
            links: when a recipe has no video, we offer a YouTube search instead.
          </p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p>
            No accounts, analytics, ads or cookies. Your saved recipes, recent spins and filter choices are stored in your
            browser’s local storage and never sent anywhere. Recipe photos load from TheMealDB. YouTube’s player loads
            only when you press play, through its privacy-enhanced domain (youtube-nocookie.com). Once it loads, YouTube’s
            own policies apply.
          </p>
        </Section>

        <Section title="Built in the open">
          <p>
            The importer, matching rules and tests are in the{" "}
            <a className="font-semibold text-accent underline underline-offset-4" href="https://github.com/VaraKare/mr-cook" target="_blank" rel="noopener">source repository</a>.
            Found a wrong ingredient or a broken link? Open an issue there.
          </p>
          <p>
            <Link href="/" className="font-semibold text-accent underline underline-offset-4">Back to the wheel</Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
