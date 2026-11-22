import type { Rgb } from "./theme-color.ts";
import type { Theme, ThemeAppearance, ThemeTokenName } from "./theme.ts";

import {
  compositeOver,
  contrastRatio,
  parseThemeColor,
} from "./theme-color.ts";

export type ThemeColors = Pick<Theme, "appearance" | "tokens">;

export const TEXT_CONTRAST = 4.5;
export const UI_CONTRAST = 3;
const BLOCK_BELOW = 3;

const opaque = (hex: string): Rgb =>
  parseThemeColor(hex) ?? { b: 0, g: 0, r: 0 };

export const REFERENCE_WALLPAPER: Record<ThemeAppearance, Rgb> = {
  dark: opaque("#1a1a1c"),
  light: opaque("#f0f0f1"),
};

export interface ContrastPair {
  id: string;
  fg: ThemeTokenName;
  // Backgrounds from the bottom up; translucent layers composite over the
  // wallpaper and each other, the way the panel sits over the desktop.
  over: readonly ThemeTokenName[];
  min: number;
  core: boolean;
}

const pair = (
  fg: ThemeTokenName,
  over: ThemeTokenName | ThemeTokenName[],
  min = TEXT_CONTRAST,
  core = false
): ContrastPair => {
  const layers = Array.isArray(over) ? over : [over];
  return { core, fg, id: `${fg}/${layers.join("+")}`, min, over: layers };
};

const CHARTS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
] as const;
const CONNECTIONS = [
  "conn-honey",
  "conn-denim",
  "conn-moss",
  "conn-plum",
  "conn-clay",
  "conn-stone",
] as const;

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  pair("foreground", "background", TEXT_CONTRAST, true),
  pair("foreground", "card"),
  pair("foreground", "panel", TEXT_CONTRAST, true),
  pair("foreground", "panel-solid"),
  pair("foreground", ["panel", "row-active"]),
  pair("panel-muted", "panel"),
  pair("panel-muted", ["panel", "panel-raised"]),
  pair("panel-muted", ["panel", "row-active"]),
  pair("primary-foreground", "primary", TEXT_CONTRAST, true),
  pair("secondary-foreground", "secondary"),
  pair("muted-foreground", "muted"),
  pair("muted-foreground", "background"),
  pair("accent-foreground", "accent"),
  pair("destructive-foreground", "destructive"),
  pair("warning-foreground", "warning"),
  pair("success-foreground", "success"),
  pair("danger-ink", "panel"),
  pair("success-ink", "panel"),
  pair("warning-ink", "panel"),
  pair("ring", "panel", UI_CONTRAST),
  pair("ring", "background", UI_CONTRAST),
  pair("brand", "panel", UI_CONTRAST),
  pair("brand", "background", UI_CONTRAST),
  ...CHARTS.flatMap((chart) => [
    pair(chart, "card", UI_CONTRAST),
    pair(chart, "panel", UI_CONTRAST),
  ]),
  ...CONNECTIONS.map((connection) => pair(connection, "panel", UI_CONTRAST)),
];

export type ContrastLevel = "ok" | "warn" | "block";

export interface ContrastEntry {
  pair: ContrastPair;
  ratio: number;
  level: ContrastLevel;
}

const color = (theme: ThemeColors, name: ThemeTokenName) => {
  const parsed = parseThemeColor(theme.tokens[name]);
  return parsed ?? { a: 1, b: 0, g: 0, r: 0 };
};

const ratioOf = (theme: ThemeColors, spec: ContrastPair): number => {
  let base: Rgb = REFERENCE_WALLPAPER[theme.appearance];
  for (const layer of spec.over) {
    base = compositeOver(color(theme, layer), base);
  }
  return contrastRatio(compositeOver(color(theme, spec.fg), base), base);
};

const levelOf = (spec: ContrastPair, ratio: number): ContrastLevel => {
  if (ratio >= spec.min) {
    return "ok";
  }
  return spec.core && ratio < BLOCK_BELOW ? "block" : "warn";
};

export const themeContrastReport = (theme: ThemeColors): ContrastEntry[] =>
  CONTRAST_PAIRS.map((spec) => {
    const ratio = ratioOf(theme, spec);
    return { level: levelOf(spec, ratio), pair: spec, ratio };
  });

export const themeProblems = (theme: ThemeColors): ContrastEntry[] =>
  themeContrastReport(theme).filter((entry) => entry.level === "block");
