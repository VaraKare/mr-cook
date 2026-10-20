export const SITE_NAME = "Mr. Cook";
export const SITE_TAGLINE = "Spin for a dish, or cook with what you have.";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Prefix a public asset path with the deployment base path. */
export function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * TheMealDB serves resized variants by suffix: /small (150px), /large
 * (350px); the bare URL is the 700px original.
 */
export function imageVariant(url: string | null, size: "small" | "large" | "full"): string | null {
  if (!url) return null;
  if (!url.includes("themealdb.com/images/media/meals/")) return url;
  return size === "full" ? url : `${url}/${size}`;
}

export function recipePath(slug: string): string {
  return `/recipe/${slug}/`;
}

export function youtubeSearchUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} recipe`)}`;
}
