import type { Rgba } from "@conch/rpc";

import { parseThemeColor, toHex } from "@conch/rpc";

const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i;

const OPAQUE_BLACK: Rgba = { a: 1, b: 0, g: 0, r: 0 };

const colorOf = (value: string): Rgba => parseThemeColor(value) ?? OPAQUE_BLACK;

export const normalizeHex = (text: string): string | null => {
  const trimmed = text.trim();
  const short = trimmed.match(SHORT_HEX);
  if (short) {
    const [, r = "", g = "", b = ""] = short;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const long = trimmed.match(LONG_HEX);
  return long?.[1] ? `#${long[1].toLowerCase()}` : null;
};

export const hexOf = (value: string): string => toHex(colorOf(value));

export const rgbHexOf = (value: string): string =>
  toHex({ ...colorOf(value), a: 1 });

export const opacityOf = (value: string): number =>
  Math.round(colorOf(value).a * 100);

export const withOpacity = (value: string, percent: number): string =>
  toHex({ ...colorOf(value), a: Math.min(100, Math.max(0, percent)) / 100 });

// A pasted #rrggbbaa sets the opacity too; #rrggbb keeps the current one.
export const withRgb = (value: string, hex: string): string => {
  const next = colorOf(hex);
  return hex.length === 9
    ? toHex(next)
    : toHex({ ...next, a: colorOf(value).a });
};

const OPACITY = /^\d{1,3}$/;

export const parseOpacity = (text: string): number | null => {
  const trimmed = text.trim();
  if (!OPACITY.test(trimmed)) {
    return null;
  }
  const percent = Number(trimmed);
  return percent <= 100 ? percent : null;
};
