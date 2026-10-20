import { asset } from "@/lib/site";

/**
 * Start downloading the recipe index with the HTML instead of after the
 * JavaScript boots. React hoists this <link> into <head>. `crossOrigin`
 * matches the credentials mode of the later fetch() so the browser reuses it.
 */
export function PreloadDiscovery() {
  return <link rel="preload" href={asset("/data/discovery.json")} as="fetch" type="application/json" crossOrigin="anonymous" />;
}
