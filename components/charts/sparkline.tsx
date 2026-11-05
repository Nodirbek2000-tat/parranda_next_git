import { CHART_COLORS } from "@/lib/stats";

/**
 * Tiny trend line for KPI cards. Scales to its container (`viewBox` +
 * non-scaling stroke keeps the 1.5 px line crisp); `null` values are skipped.
 */
export function Sparkline({
  values,
  color = CHART_COLORS.accent,
  height = 28,
  label,
}: {
  values: readonly (number | null)[];
  color?: string;
  height?: number;
  label?: string;
}) {
  const points: [number, number][] = [];
  values.forEach((value, index) => {
    if (value !== null && Number.isFinite(value)) points.push([index, value]);
  });
  if (points.length < 2) return <div style={{ height }} aria-hidden />;
  const width = 100;
  const min = Math.min(...points.map(([, value]) => value));
  const max = Math.max(...points.map(([, value]) => value));
  const span = max - min || 1;
  const last = values.length - 1 || 1;
  const pad = 3;
  const toX = (index: number) => ((index / last) * width).toFixed(2);
  // A flat series is drawn through the middle, so a constant non-zero value never looks like zero.
  const toY = (value: number) =>
    (max === min ? height / 2 : pad + (1 - (value - min) / span) * (height - pad * 2)).toFixed(2);
  const line = points.map(([index, value], i) => `${i === 0 ? "M" : "L"}${toX(index)},${toY(value)}`).join("");
  const area = `${line}L${toX(points[points.length - 1][0])},${height}L${toX(points[0][0])},${height}Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full overflow-visible"
      style={{ height }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={area} fill={CHART_COLORS.accent} fillOpacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
