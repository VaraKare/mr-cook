import { sample, type Rng } from "./random";

/*
 * Wheel geometry. The pointer sits at 12 o'clock. At rotation 0, slice i spans
 * [i * seg, (i + 1) * seg) degrees clockwise from the top. Rotating the wheel
 * clockwise by R degrees moves slice i's centre to (i + 0.5) * seg + R.
 *
 * The recipe is chosen first; the animation is then computed to land on it.
 * The animation never decides the result.
 */

export function sliceAngle(size: number): number {
  return 360 / size;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Index of the slice under the pointer for a given rotation. */
export function sliceUnderPointer(rotationDeg: number, size: number): number {
  return Math.floor(mod(-rotationDeg, 360) / sliceAngle(size)) % size;
}

/**
 * Final rotation that lands `targetIndex` under the pointer after at least
 * `turns` full clockwise turns. `jitter` in [-1, 1] offsets the stop point
 * within the slice so landings don't look mechanical, while staying well
 * clear of slice edges.
 */
export function targetRotation(currentDeg: number, targetIndex: number, size: number, turns = 5, jitter = 0): number {
  const seg = sliceAngle(size);
  const clamped = Math.max(-1, Math.min(1, jitter));
  const desired = -(targetIndex + 0.5) * seg + clamped * seg * 0.35;
  const base = currentDeg + turns * 360;
  return base + mod(desired - base, 360);
}

/**
 * Lay out the wheel so that `chosen` is on it, changing as little of the
 * current wheel as possible. When the chosen dish is not already showing, it
 * replaces the slice opposite the pointer (the one least in view).
 */
export function placeOnWheel<T extends { id: string }>(
  chosen: T,
  current: T[],
  pool: T[],
  size: number,
  rotationDeg: number,
  rng: Rng,
): { slices: T[]; targetIndex: number } {
  let slices = current.length === size ? current.slice() : [];
  if (slices.length === 0) {
    slices = sample(pool.filter((r) => r.id !== chosen.id), size - 1, rng);
    const at = Math.floor(rng() * (slices.length + 1));
    slices.splice(at, 0, chosen);
    // A small pool repeats dishes rather than leaving gaps (appended after `at`).
    for (let i = 0; slices.length < size; i++) slices.push(slices[i]);
    return { slices, targetIndex: at };
  }

  const existing = slices.findIndex((s) => s.id === chosen.id);
  if (existing !== -1) return { slices, targetIndex: existing };

  const hidden = (sliceUnderPointer(rotationDeg, size) + Math.floor(size / 2)) % size;
  slices[hidden] = chosen;
  return { slices, targetIndex: hidden };
}

/** Initial wheel before any spin. */
export function initialWheel<T>(pool: T[], size: number, rng: Rng): T[] {
  const picked = sample(pool, size, rng);
  for (let i = 0; picked.length > 0 && picked.length < size; i++) picked.push(picked[i]);
  return picked;
}
