#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, "..", "src", "mainview", "index.css");
const OUT_PATH = join(HERE, "..", "docs", "color-tokens.md");

interface Rgb {
  r: number;
  g: number;
  b: number;
}
type Color = Rgb & { a: number };
type TokenMap = Map<string, Color>;
type Scheme = "light" | "dark";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const encodeSrgb = (linear: number): number => {
  const x = clamp01(linear);
  return x <= 0.003_130_8 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

const decodeSrgb = (encoded: number): number =>
  encoded <= 0.040_45 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;

const oklchToRgb = (l: number, c: number, h: number): Rgb => {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const lCubed = (l + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const mCubed = (l - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const sCubed = (l - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  return {
    b: encodeSrgb(
      -0.004_196_086_3 * lCubed -
        0.703_418_614_7 * mCubed +
        1.707_614_701 * sCubed
    ),
    g: encodeSrgb(
      -1.268_438_004_6 * lCubed +
        2.609_757_401_1 * mCubed -
        0.341_319_396_5 * sCubed
    ),
    r: encodeSrgb(
      4.076_741_661_2 * lCubed -
        3.307_711_591_3 * mCubed +
        0.230_969_929 * sCubed
    ),
  };
};

const OKLCH =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/i;

const fraction = (raw: string): number =>
  raw.endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);

const parseOklch = (value: string): Color | null => {
  const match = value.match(OKLCH);
  if (!match) {
    return null;
  }
  const [, l = "0", c = "0", h = "0", alpha] = match;
  const rgb = oklchToRgb(fraction(l), Number(c), Number(h));
  return { ...rgb, a: alpha ? fraction(alpha) : 1 };
};

const blockAfter = (css: string, marker: string): string => {
  const start = css.indexOf(marker);
  if (start === -1) {
    throw new Error(`index.css has no "${marker}" block`);
  }
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("\n}", open));
};

const declarations = (block: string): Map<string, string> =>
  new Map(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(
      ([, name = "", raw = ""]) => [name, raw.trim().replaceAll(/\s+/g, " ")]
    )
  );

const resolveTokens = (
  shared: Map<string, string>,
  scheme: Map<string, string>
): TokenMap => {
  const all = new Map([...shared, ...scheme]);
  const resolve = (value: string, depth = 0): Color | null => {
    const alias = value.match(/^var\(--([\w-]+)\)$/);
    if (alias?.[1] && depth < 4) {
      const target = all.get(alias[1]);
      return target ? resolve(target, depth + 1) : null;
    }
    return parseOklch(value);
  };
  const tokens: TokenMap = new Map();
  for (const [name, value] of all) {
    const color = resolve(value);
    if (color) {
      tokens.set(name, color);
    }
  }
  return tokens;
};

const parseSchemes = (css: string): Record<Scheme, TokenMap> => {
  const shared = declarations(blockAfter(css, ":root {"));
  return {
    dark: resolveTokens(shared, declarations(blockAfter(css, "\n.dark {"))),
    light: resolveTokens(
      shared,
      declarations(blockAfter(css, ":root,\n.light {"))
    ),
  };
};

const compositeOver = (top: Color, base: Rgb): Rgb => ({
  b: top.b * top.a + base.b * (1 - top.a),
  g: top.g * top.a + base.g * (1 - top.a),
  r: top.r * top.a + base.r * (1 - top.a),
});

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * decodeSrgb(r) + 0.7152 * decodeSrgb(g) + 0.0722 * decodeSrgb(b);

const contrastRatio = (one: Rgb, two: Rgb): number => {
  const [light, dark] = [luminance(one), luminance(two)].toSorted(
    (x, y) => y - x
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

const hexOf = (value: number): string =>
  Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, "0");

const WALLPAPER: Record<Scheme, Rgb> = {
  dark: { b: 0x1c / 255, g: 0x1a / 255, r: 0x1a / 255 },
  light: { b: 0xf1 / 255, g: 0xf0 / 255, r: 0xf0 / 255 },
};

const TEXT = 4.5;
const UI = 3;

interface Pair {
  fg: string;
  // Backgrounds from the bottom up; translucent layers composite over the
  // wallpaper and each other, the way the panel sits over the desktop.
  over: readonly string[];
  min: number;
}

const pair = (fg: string, over: string | string[], min = TEXT): Pair => ({
  fg,
  min,
  over: Array.isArray(over) ? over : [over],
});

const PANEL_ROW = ["panel", "row-active"];
const CHARTS = [1, 2, 3, 4, 5, 6].map((n) => `chart-${n}`);
const CONNECTIONS = ["honey", "denim", "moss", "plum", "clay", "stone"].map(
  (name) => `conn-${name}`
);

const PAIRS: readonly Pair[] = [
  pair("foreground", "background"),
  pair("foreground", "card"),
  pair("foreground", "panel"),
  pair("foreground", "panel-solid"),
  pair("foreground", PANEL_ROW),
  pair("panel-muted", "panel"),
  pair("panel-muted", ["panel", "panel-raised"]),
  pair("panel-muted", PANEL_ROW),
  pair("primary-foreground", "primary"),
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
  pair("ring", "panel", UI),
  pair("ring", "background", UI),
  pair("brand", "panel", UI),
  pair("brand", "background", UI),
  ...CHARTS.flatMap((chart) => [
    pair(chart, "card", UI),
    pair(chart, "panel", UI),
  ]),
  ...CONNECTIONS.map((connection) => pair(connection, "panel", UI)),
];

interface Row {
  pair: Pair;
  ratio: number;
}

const evaluate = (tokens: TokenMap, scheme: Scheme, spec: Pair): Row => {
  let base = WALLPAPER[scheme];
  for (const layer of spec.over) {
    const color = tokens.get(layer);
    if (!color) {
      throw new Error(`${scheme}: --${layer} is not an oklch token`);
    }
    base = compositeOver(color, base);
  }
  const fg = tokens.get(spec.fg);
  if (!fg) {
    throw new Error(`${scheme}: --${spec.fg} is not an oklch token`);
  }
  return { pair: spec, ratio: contrastRatio(compositeOver(fg, base), base) };
};

const passes = (row: Row): boolean => row.ratio >= row.pair.min;

const pairTable = (rows: readonly Row[]): string =>
  [
    "| Foreground | Over | Ratio | Minimum | Status |",
    "| --- | --- | ---: | ---: | :---: |",
    ...rows.map(
      (row) =>
        `| \`--${row.pair.fg}\` | ${row.pair.over.map((layer) => `\`--${layer}\``).join(" → ")} | ${row.ratio.toFixed(2)} | ${row.pair.min.toFixed(1)} | ${passes(row) ? "PASS" : "FAIL"} |`
    ),
  ].join("\n");

const tokenTable = (tokens: TokenMap): string =>
  [
    "| Token | sRGB | Alpha |",
    "| --- | --- | ---: |",
    ...[...tokens.entries()]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(
        ([name, color]) =>
          `| \`--${name}\` | \`#${hexOf(color.r)}${hexOf(color.g)}${hexOf(color.b)}\` | ${color.a.toFixed(2)} |`
      ),
  ].join("\n");

const main = (): void => {
  const schemes = parseSchemes(readFileSync(CSS_PATH, "utf8"));
  const rows = {
    dark: PAIRS.map((spec) => evaluate(schemes.dark, "dark", spec)),
    light: PAIRS.map((spec) => evaluate(schemes.light, "light", spec)),
  };

  writeFileSync(
    OUT_PATH,
    [
      "# Color Token WCAG AA Audit",
      "",
      "Generated by `apps/app/scripts/audit-contrast.ts` from",
      "`apps/app/src/mainview/index.css`. Re-run with",
      "`bun run apps/app/scripts/audit-contrast.ts` after changing any token.",
      "",
      "Translucent layers are composited in gamma-encoded sRGB, as CSS does,",
      "from the bottom up over a reference wallpaper: dark `#1a1a1c`,",
      "light `#f0f0f1`. Minimums: text 4.5:1, UI marks and focus rings 3:1.",
      "",
      "## Dark",
      "",
      pairTable(rows.dark),
      "",
      "## Light",
      "",
      pairTable(rows.light),
      "",
      "## Dark tokens (resolved sRGB)",
      "",
      tokenTable(schemes.dark),
      "",
      "## Light tokens (resolved sRGB)",
      "",
      tokenTable(schemes.light),
      "",
    ].join("\n")
  );

  const failures = (["dark", "light"] as const).flatMap((scheme) =>
    rows[scheme]
      .filter((row) => !passes(row))
      .map(
        (row) =>
          `  ${scheme} FAIL ${row.ratio.toFixed(2)} (need ${row.pair.min}): --${row.pair.fg} over ${row.pair.over.join(" → ")}`
      )
  );
  console.log(
    `Audited ${PAIRS.length * 2} pairs. ${failures.length} failing.\n${failures.join("\n")}`.trimEnd()
  );
  console.log(`Report written to ${OUT_PATH}`);
  if (failures.length > 0) {
    process.exit(1);
  }
};

main();
