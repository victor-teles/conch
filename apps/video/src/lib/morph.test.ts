import { describe, expect, it } from "vitest";

import { isBetween, morphValue } from "./morph";

const stepAt = (frame: number) => (at: number) => (frame >= at ? 1 : 0);
const halfway = () => 0.5;

const STEPS = [
  { at: 0, value: 100 },
  { at: 10, value: 200 },
  { at: 20, value: 150 },
];

describe("morphValue", () => {
  it("starts at the first value", () => {
    expect(morphValue(STEPS, stepAt(5))).toBe(100);
  });

  it("lands on each step once its progress completes", () => {
    expect(morphValue(STEPS, stepAt(10))).toBe(200);
    expect(morphValue(STEPS, stepAt(20))).toBe(150);
  });

  it("blends overlapping steps by their progress", () => {
    expect(morphValue(STEPS, halfway)).toBe(125);
  });

  it("is zero without steps", () => {
    expect(morphValue([], halfway)).toBe(0);
  });
});

describe("isBetween", () => {
  it("includes the start and excludes the end", () => {
    expect(isBetween(10, 10, 20)).toBeTruthy();
    expect(isBetween(20, 10, 20)).toBeFalsy();
    expect(isBetween(9, 10, 20)).toBeFalsy();
  });
});
