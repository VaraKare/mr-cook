import { youtubeSearchUrl } from "@/lib/site";

/**
 * Opens YouTube's search results for "<recipe> recipe" in a new tab, so
 * YouTube suggests the videos. No API or key involved.
 */
export function YouTubeButton({ title, compact = false }: { title: string; compact?: boolean }) {
  return (
    <a
      href={youtubeSearchUrl(title)}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn ${compact ? "min-h-10 px-3.5 py-1.5 text-sm" : ""} bg-[#c4302b] text-white hover:bg-[#a52521]`}
    >
      <svg width={compact ? 18 : 20} height={compact ? 18 : 20} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
        <path d="M10 9v6l5-3-5-3Z" fill="#c4302b" />
      </svg>
      {compact ? "YouTube" : "Watch on YouTube"}
      <span className="sr-only"> (searches YouTube for “{title}” videos, opens in a new tab)</span>
    </a>
  );
}
