import type { SVGProps } from "react";

const PATHS = {
  spin: "M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5",
  heart: "M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4.35-4.35",
  close: "M6 6l12 12M18 6 6 18",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  basket: "M5 10h14l-1.5 9a1 1 0 0 1-1 .8h-9a1 1 0 0 1-1-.8L5 10Zm3 0 2-5m6 5-2-5M3 10h18",
  check: "m5 12.5 4.5 4.5L19 7",
  filter: "M4 6h16M7 12h10M10 18h4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  video: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 17.5v-11ZM16 10l4-2.5v9L16 14",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2",
  alert: "M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, filled = false, ...props }: { name: IconName; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
