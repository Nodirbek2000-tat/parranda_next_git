/**
 * Small math helpers shared by the SVG charts (no chart library, see docs/API_CONTRACT_V2.md 6.2).
 */

/** "Nice" step (1, 2, 2.5, 5 × 10^n) so that `count` steps cover `max`. */
function niceStep(max: number, count: number): number {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Y axis ticks from `min` (0 for counts) to a nice maximum: `count` intervals
 * → `count + 1` tick values. A flat series of zeros still gets a 0…1 axis.
 */
export function niceTicks(minValue: number, maxValue: number, count = 3): number[] {
  const min = Math.min(0, minValue);
  // A flat series (all zeros) still gets a readable 0…count axis.
  const max = maxValue > min ? maxValue : min + count;
  let step = niceStep(max - min, count);
  // Integers stay integers on count axes (no "0.5 dona").
  if (Number.isInteger(minValue) && Number.isInteger(maxValue) && step < 1) step = 1;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [start];
  while (ticks[ticks.length - 1] < max - 1e-9) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(10)));
  return ticks;
}

/** Indices of at most `max` evenly spaced labels, always including the first and last. */
export function labelIndices(length: number, max = 6): number[] {
  if (length <= 0) return [];
  if (length <= max) return Array.from({ length }, (_, index) => index);
  const step = (length - 1) / (max - 1);
  const result = new Set<number>();
  for (let index = 0; index < max; index += 1) result.add(Math.round(index * step));
  return [...result].sort((a, b) => a - b);
}

/** Path of a bar with rounded data end and a square baseline. */
export function columnPath(x: number, y: number, width: number, height: number, radius = 2): string {
  if (height <= 0 || width <= 0) return "";
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;
  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${bottom}Z`;
}
