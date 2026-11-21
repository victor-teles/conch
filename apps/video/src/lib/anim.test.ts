import { describe, expect, it } from "vitest";

import { fadeIn, fadeOut, progress } from "./anim";

describe("fadeIn", () => {
  it("clamps before and after its window", () => {
    expect(fadeIn(0, 10)).toBe(0);
    expect(fadeIn(15, 10)).toBe(1);
    expect(fadeIn(40, 10)).toBe(1);
  });

  it("eases out across its window", () => {
    expect(fadeIn(11, 10, 4)).toBeGreaterThan(0.25);
  });
});

describe("fadeOut", () => {
  it("is fully visible until it starts", () => {
    expect(fadeOut(5, 10)).toBe(1);
    expect(fadeOut(14, 10)).toBe(0);
  });
});

describe("progress", () => {
  it("runs from zero to one over its duration", () => {
    expect(progress(0, 10, 20)).toBe(0);
    expect(progress(30, 10, 20)).toBe(1);
  });
});
