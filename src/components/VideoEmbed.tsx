"use client";

import { useState } from "react";
import type { RecipeVideo } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Click-to-load YouTube player. Nothing is requested from YouTube's player
 * until the visitor presses play, and it uses the privacy-enhanced domain.
 */
export function VideoEmbed({ video, recipeTitle }: { video: RecipeVideo; recipeTitle: string }) {
  const [playing, setPlaying] = useState(false);
  const label = video.title ?? `${recipeTitle} video`;
  if (!/^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)) return null;

  return (
    <figure>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#14110f]">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="group absolute inset-0 h-full w-full" onClick={() => setPlaying(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
            />
            <span className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent">
              <Icon name="play" size={26} filled />
            </span>
            <span className="sr-only">Play video: {label}</span>
          </button>
        )}
      </div>
      <figcaption className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          {video.title ? <span className="font-medium">{video.title}</span> : <span className="text-muted">Video linked by the recipe source</span>}
          {video.channelTitle && <span className="text-muted"> · {video.channelTitle}</span>}
        </span>
        <a href={video.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline">
          Watch on YouTube
          <Icon name="external" size={14} />
        </a>
      </figcaption>
    </figure>
  );
}
