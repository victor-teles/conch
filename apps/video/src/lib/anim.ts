import type { SpringConfig } from "remotion";

import { Easing, interpolate, spring, useVideoConfig } from "remotion";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const fadeIn = (frame: number, start: number, duration = 5): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

export const fadeOut = (frame: number, start: number, duration = 4): number =>
  interpolate(frame, [start, start + duration], [1, 0], {
    ...CLAMP,
    easing: EASE_IN,
  });

export const progress = (
  frame: number,
  start: number,
  duration: number
): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

export const useSpringAt = (config: Partial<SpringConfig>) => {
  const { fps } = useVideoConfig();
  return (frame: number, start: number): number =>
    frame < start ? 0 : spring({ config, fps, frame: frame - start });
};
