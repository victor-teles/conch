import { describe, expect, it } from "vitest";

import {
  compositeOver,
  contrastRatio,
  isThemeColor,
  parseThemeColor,
  toHex,
} from "./theme-color.ts";

const WHITE = { a: 1, b: 1, g: 1, r: 1 };
const BLACK = { a: 1, b: 0, g: 0, r: 0 };

const hexFrom = (value: string): string => {
  const color = parseThemeColor(value);
  if (!color) {
    throw new Error(`${value} does not parse`);
  }
  return toHex(color);
};

describe("theme colors", () => {
  it("parses oklch and hex to the same sRGB", () => {
    expect(hexFrom("oklch(0.66 0.22 29)")).toBe("#fc4738");
    expect(parseThemeColor("oklch(1 0 0)")).toMatchObject({ a: 1 });
    expect(hexFrom("oklch(100% 0 0deg)")).toBe("#ffffff");
    expect(parseThemeColor("#FC4738")).toStrictEqual(
      parseThemeColor("#fc4738")
    );
  });

  it("round-trips alpha through hex", () => {
    const translucent = parseThemeColor("oklch(1 0 0 / 0.5)");
    expect(translucent?.a).toBe(0.5);
    expect(hexFrom("#11223380")).toBe("#11223380");
    expect(toHex({ ...WHITE, a: 1 })).toBe("#ffffff");
    expect(parseThemeColor("oklch(0.5 0 0 / 14%)")?.a).toBeCloseTo(0.14);
  });

  it("composites a translucent layer over its base", () => {
    expect(compositeOver({ ...WHITE, a: 0.5 }, BLACK)).toStrictEqual({
      a: 1,
      b: 0.5,
      g: 0.5,
      r: 0.5,
    });
  });

  it("measures WCAG contrast", () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21);
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21);
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
  });

  it.each([
    "red",
    "var(--x)",
    "url(x)",
    "#12",
    "#1234",
    "#12345",
    "oklch(1 0 0);x",
    "oklch(1  0 0)",
    " #ffffff",
    "#ffffff ",
    "oklch(1 0 0 / )",
    "color-mix(in oklab, red, blue)",
    "oklch(-1 0 0)",
    "rgb(0 0 0)",
  ])("rejects %s", (value) => {
    expect(isThemeColor(value)).toBeFalsy();
    expect(parseThemeColor(value)).toBeNull();
  });
});
