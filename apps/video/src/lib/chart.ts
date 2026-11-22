export interface PlotBox {
  width: number;
  height: number;
}

export type Point = readonly [x: number, y: number];

export type Span = readonly [start: number, end: number];

export interface Ring {
  cx: number;
  cy: number;
  outer: number;
  inner: number;
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
const TURN = Math.PI * 2;

export const niceCeiling = (value: number): number => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((m) => m * magnitude >= value) ?? 10;
  return step * magnitude;
};

export const pointsOf = (
  values: readonly number[],
  max: number,
  box: PlotBox
): Point[] => {
  const stepX = values.length > 1 ? box.width / (values.length - 1) : 0;
  return values.map((value, index) => [
    index * stepX,
    box.height - (value / max) * box.height,
  ]);
};

export const linePath = (points: readonly Point[]): string =>
  points
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    )
    .join(" ");

const trimZero = (value: string): string => value.replace(/\.0$/, "");

export const formatThousands = (value: number): string => {
  if (value >= 1_000_000) {
    return `$${trimZero((value / 1_000_000).toFixed(1))}M`;
  }
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`;
};

export const countUp = (value: number, progress: number): number =>
  progress >= 0.99 ? value : value * progress;

export const formatInteger = (value: number): string =>
  Math.round(value).toLocaleString("en-US");

export const sliceSpans = (
  values: readonly number[],
  swept: number
): Span[] => {
  const total = values.reduce((sum, value) => sum + value, 0);
  const limit = TURN * Math.min(Math.max(swept, 0), 1);
  let start = 0;
  return values.map((value) => {
    const end = start + (total === 0 ? 0 : (value / total) * TURN);
    const span: Span = [Math.min(start, limit), Math.min(end, limit)];
    start = end;
    return span;
  });
};

const polar = (cx: number, cy: number, radius: number, angle: number) =>
  `${(cx + radius * Math.sin(angle)).toFixed(2)} ${(cy - radius * Math.cos(angle)).toFixed(2)}`;

export const arcPath = (ring: Ring, [start, end]: Span): string => {
  if (end - start <= 0) {
    return "";
  }
  const { cx, cy, outer, inner } = ring;
  const stop = start + Math.min(end - start, TURN - 1e-4);
  const large = stop - start > Math.PI ? 1 : 0;
  return [
    `M${polar(cx, cy, outer, start)}`,
    `A${outer} ${outer} 0 ${large} 1 ${polar(cx, cy, outer, stop)}`,
    `L${polar(cx, cy, inner, stop)}`,
    `A${inner} ${inner} 0 ${large} 0 ${polar(cx, cy, inner, start)}`,
    "Z",
  ].join(" ");
};

export const stackSpans = (
  series: readonly (readonly number[])[],
  category: number
): Span[] => {
  let base = 0;
  return series.map((values) => {
    const top = base + (values[category] ?? 0);
    const span: Span = [base, top];
    base = top;
    return span;
  });
};

export const staggered = (
  progress: number,
  index: number,
  count: number,
  overlap = 0.5
): number => {
  const width = 1 / (1 + (count - 1) * (1 - overlap));
  const start = index * width * (1 - overlap);
  return Math.min(Math.max((progress - start) / width, 0), 1);
};
