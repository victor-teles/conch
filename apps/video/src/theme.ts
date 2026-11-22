import type { SpringConfig } from "remotion";

export const COLOR = {
  amber: "oklch(0.9247 0.0524 66.1732)",
  amberGlow: "oklch(0.82 0.08 66 / 0.16)",
  chart1: "oklch(0.82 0.12 70)",
  chart2: "oklch(0.76 0.09 185)",
  chart3: "oklch(0.74 0.13 30)",
  chart4: "oklch(0.72 0.1 250)",
  chart5: "oklch(0.76 0.1 140)",
  danger: "oklch(0.76 0.13 33)",
  dangerBorder: "oklch(0.55 0.21 33 / 0.35)",
  dangerTint: "oklch(0.55 0.21 33 / 0.12)",
  foreground: "oklch(0.9491 0.004 41)",
  ink: "oklch(0.182 0.007 34.3)",
  inkDeep: "oklch(0.13 0.006 34)",
  kbd: "oklch(1 0 0 / 0.08)",
  muted: "oklch(0.8 0.006 55)",
  panel: "oklch(0.185 0.008 45 / 0.86)",
  panelBorder: "oklch(1 0 0 / 0.1)",
  panelHighlight: "oklch(1 0 0 / 0.07)",
  panelRaised: "oklch(0.27 0.007 45 / 0.85)",
  rowActive: "oklch(0.82 0.08 66 / 0.2)",
  rowHover: "oklch(1 0 0 / 0.06)",
  success: "oklch(0.8 0.13 145)",
} as const;

export const CONNECTION_COLOR = {
  clay: "oklch(0.7 0.12 35)",
  denim: "oklch(0.65 0.09 235)",
  honey: "oklch(0.78 0.11 75)",
  moss: "oklch(0.68 0.07 145)",
  plum: "oklch(0.62 0.09 310)",
  stone: "oklch(0.6 0.02 80)",
} as const;

export const FONT = {
  mono: '"JetBrains Mono Variable", ui-monospace, monospace',
  sans: '"Mona Sans Variable", -apple-system, system-ui, sans-serif',
} as const;

export const MONO_FEATURES = '"calt", "liga" 0, "zero", "ss02"';

export const TYPE = {
  body: {
    fontSize: 13,
    fontWeight: 450,
    letterSpacing: 0,
    lineHeight: "18px",
  },
  input: {
    fontSize: 17,
    fontWeight: 450,
    letterSpacing: "-0.01em",
    lineHeight: "24px",
  },
  meta: {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.005em",
    lineHeight: "16px",
  },
  micro: {
    fontSize: 11,
    fontWeight: 520,
    letterSpacing: "0.02em",
    lineHeight: "14px",
  },
  title: {
    fontSize: 14,
    fontWeight: 560,
    letterSpacing: "-0.006em",
    lineHeight: "20px",
  },
} as const;

export const SPRING: Partial<SpringConfig> = { damping: 30, stiffness: 400 };
export const SPRING_SNAPPY: Partial<SpringConfig> = {
  damping: 49,
  stiffness: 600,
};
export const SPRING_SOFT: Partial<SpringConfig> = {
  damping: 32,
  stiffness: 260,
};

export const PANEL_WIDTH = 760;
export const UI_SCALE = 1.55;
