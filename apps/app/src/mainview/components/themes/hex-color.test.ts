import { describe, expect, it } from "vitest";

import {
  hexOf,
  normalizeHex,
  opacityOf,
  parseOpacity,
  rgbHexOf,
  withOpacity,
  withRgb,
} from "./hex-color";

describe("hex colors", () => {
  it.each([
    ["#abc", "#aabbcc"],
    ["ABC", "#aabbcc"],
    [" #A1B2C3 ", "#a1b2c3"],
    ["#a1b2c3d4", "#a1b2c3d4"],
  ])("normalizes %j", (text, hex) => {
    expect(normalizeHex(text)).toBe(hex);
  });

  it.each(["", "#ab", "#abcd", "#ggg", "red", "#a1b2c3d"])(
    "rejects %j",
    (text) => {
      expect(normalizeHex(text)).toBeNull();
    }
  );

  it("shows oklch values as hex", () => {
    expect(hexOf("oklch(1 0 0)")).toBe("#ffffff");
    expect(hexOf("oklch(1 0 0 / 0.5)")).toBe("#ffffff80");
    expect(rgbHexOf("oklch(1 0 0 / 0.5)")).toBe("#ffffff");
    expect(opacityOf("oklch(1 0 0 / 0.14)")).toBe(14);
  });

  it("changes opacity and keeps it across rgb edits", () => {
    expect(withOpacity("#ffffff", 50)).toBe("#ffffff80");
    expect(withOpacity("#ffffff", 100)).toBe("#ffffff");
    expect(withRgb("#ffffff80", "#000000")).toBe("#00000080");
    expect(withRgb("#ffffff80", "#000000ff")).toBe("#000000");
  });

  it.each([
    ["50", 50],
    ["0", 0],
    ["100", 100],
    ["101", null],
    ["-1", null],
    ["5.5", null],
    ["", null],
  ])("parses opacity %j", (text, percent) => {
    expect(parseOpacity(text)).toBe(percent);
  });
});
