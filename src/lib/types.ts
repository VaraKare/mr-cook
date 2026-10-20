/**
 * Unified internal schema. Every source importer maps into these shapes, so
 * the discovery features never depend on a particular provider's format.
 *
 * Rule: a field we cannot source or verify stays `null`. Nothing is invented.
 */

export type AnimalClass = "meat" | "seafood";

export interface Ingredient {
  /** Stable slug of the canonical name, e.g. "chicken-breast". */
  id: string;
  /** Human-readable canonical name, e.g. "Chicken Breast". */
  name: string;
  /** Source-provided type (e.g. TheMealDB `strType`) when known. */
  type: string | null;
  /** Derived from the ingredient name; used only for the meat-free filter. */
  animal: AnimalClass | null;
  iconUrl: string | null;
  /**
   * Broader ingredient this one belongs to (e.g. "chicken-thigh" -> "chicken").
   * Selecting the parent satisfies a child requirement and vice versa.
   */
  parentId: string | null;
  /** Number of recipes in the catalogue that use this ingredient. */
  recipeCount: number;
}

export interface RecipeIngredient {
  ingredientId: string;
  /** The ingredient name exactly as the source wrote it. */
  sourceName: string;
  /** The measure exactly as the source wrote it (always shown to users). */
  measure: string | null;
  /** Parsed from `measure` when unambiguous, otherwise null. */
  quantity: number | null;
  unit: string | null;
  /** True only when the source's own measure text marks it as optional. */
  isOptional: boolean;
}

export type VideoOrigin = "source" | "youtube-search";
export type VideoStatus = "ok" | "unavailable" | "unchecked";

export interface RecipeVideo {
  youtubeId: string;
  title: string | null;
  channelTitle: string | null;
  url: string;
  origin: VideoOrigin;
  status: VideoStatus;
  lastCheckedAt: string | null;
}

export interface RecipeSource {
  name: string;
  recipeId: string;
  /** Page for this record on the data provider's site. */
  providerUrl: string;
  /** The original recipe page the provider credits, if any. */
  originalUrl: string | null;
  licence: string;
  attribution: string;
}

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  alternateTitle: string | null;
  description: string | null;
  country: string | null;
  cuisine: string | null;
  category: string | null;
  tags: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  servings: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  instructions: string[];
  imageUrl: string | null;
  source: RecipeSource;
  ingredients: RecipeIngredient[];
  videos: RecipeVideo[];
  /** Derived: no listed ingredient is classified as meat or seafood. */
  meatFree: boolean;
  /** Whether a human has verified this record. Imported data starts false. */
  isVerified: boolean;
  /** Data-quality flags raised during import. */
  flags: QualityFlag[];
  sourceUpdatedAt: string | null;
}

export type QualityFlag =
  | "missing-image"
  | "missing-instructions"
  | "few-ingredients"
  | "missing-country"
  | "missing-measure"
  | "missing-times"
  | "no-video"
  | "video-unavailable"
  | "duplicate-title";

export interface Catalog {
  schemaVersion: 1;
  generatedAt: string;
  sources: { name: string; url: string; terms: string; attribution: string }[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  /** normalised alias -> ingredient id */
  aliases: Record<string, string>;
}

/** Lightweight record shipped to the browser for the wheel and the finder. */
export interface RecipeSummary {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  country: string | null;
  cuisine: string | null;
  category: string | null;
  totalMinutes: number | null;
  /** Required ingredient ids. */
  req: string[];
  /** Optional ingredient ids. */
  opt: string[];
  meatFree: boolean;
  hasVideo: boolean;
}

export interface DiscoveryIndex {
  generatedAt: string;
  recipes: RecipeSummary[];
  ingredients: Ingredient[];
  aliases: Record<string, string>;
}
