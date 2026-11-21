import { describe, expect, it } from "vitest";

import { sequenceStarts, seriesDuration } from "./series";

describe("seriesDuration", () => {
  it("subtracts one overlap per transition", () => {
    expect(seriesDuration({ scenes: [100, 50, 30], transition: 10 })).toBe(160);
  });

  it("has no overlap for one scene", () => {
    expect(seriesDuration({ scenes: [90], transition: 12 })).toBe(90);
  });

  it("is zero with no scenes", () => {
    expect(seriesDuration({ scenes: [], transition: 12 })).toBe(0);
  });
});

describe("sequenceStarts", () => {
  it("starts each scene one transition before the previous one ends", () => {
    expect(
      sequenceStarts({ scenes: [100, 50, 30], transition: 10 })
    ).toStrictEqual([0, 90, 130]);
  });

  it("is empty with no scenes", () => {
    expect(sequenceStarts({ scenes: [], transition: 10 })).toStrictEqual([]);
  });
});
