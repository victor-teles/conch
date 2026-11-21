export interface MorphStep {
  at: number;
  value: number;
}

export const morphValue = (
  steps: readonly MorphStep[],
  progressSince: (at: number) => number
): number => {
  const [first, ...rest] = steps;
  if (!first) {
    return 0;
  }
  let { value } = first;
  let previous = first.value;
  for (const step of rest) {
    value += (step.value - previous) * progressSince(step.at);
    previous = step.value;
  }
  return value;
};

export const isBetween = (frame: number, from: number, to: number): boolean =>
  frame >= from && frame < to;
