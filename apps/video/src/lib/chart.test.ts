import { describe, expect, it } from "vitest";

import {
  arcPath,
  countUp,
  formatInteger,
  formatThousands,
  linePath,
  niceCeiling,
  pointsOf,
  sliceSpans,
  stackSpans,
  staggered,
} from "./chart";

describe("niceCeiling", () => {
  it("rounds up to a readable axis maximum", () => {
    expect(niceCeiling(258)).toBe(300);
    expect(niceCeiling(180)).toBe(200);
    expect(niceCeiling(603)).toBe(800);
    expect(niceCeiling(23)).toBe(25);
    expect(niceCeiling(100)).toBe(100);
  });

  it("never returns zero", () => {
    expect(niceCeiling(0)).toBe(1);
  });
});

describe("pointsOf", () => {
  it("spreads values across the width and flips y", () => {
    expect(
      pointsOf([0, 50, 100], 100, { height: 10, width: 20 })
    ).toStrictEqual([
      [0, 10],
      [10, 5],
      [20, 0],
    ]);
  });

  it("puts a single value at the left edge", () => {
    expect(pointsOf([5], 10, { height: 10, width: 20 })).toStrictEqual([
      [0, 5],
    ]);
  });
});

describe("linePath", () => {
  it("moves then draws lines", () => {
    expect(
      linePath([
        [0, 1],
        [2, 3],
      ])
    ).toBe("M0.00 1.00 L2.00 3.00");
  });
});

describe("formatThousands", () => {
  it("abbreviates thousands", () => {
    expect(formatThousands(475_000)).toBe("$475k");
    expect(formatThousands(800)).toBe("$800");
  });

  it("abbreviates millions without a trailing zero", () => {
    expect(formatThousands(1_500_000)).toBe("$1.5M");
    expect(formatThousands(2_000_000)).toBe("$2M");
  });
});

describe("countUp", () => {
  it("scales the value by progress", () => {
    expect(countUp(1000, 0.5)).toBe(500);
  });

  it("lands exactly on the value at the end of an eased count", () => {
    expect(countUp(4812, 0.9995)).toBe(4812);
  });
});

describe("formatInteger", () => {
  it("groups thousands", () => {
    expect(formatInteger(4812)).toBe("4,812");
    expect(formatInteger(98_420.4)).toBe("98,420");
  });
});

describe("sliceSpans", () => {
  const QUARTER = Math.PI / 2;

  it("splits a full turn by share", () => {
    expect(sliceSpans([1, 3], 1)).toStrictEqual([
      [0, QUARTER],
      [QUARTER, Math.PI * 2],
    ]);
  });

  it("clips every slice to the swept angle", () => {
    expect(sliceSpans([1, 3], 0.125)).toStrictEqual([
      [0, QUARTER / 2],
      [QUARTER / 2, QUARTER / 2],
    ]);
  });

  it("returns empty spans for an empty total", () => {
    expect(sliceSpans([0, 0], 1)).toStrictEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});

describe("arcPath", () => {
  const ring = { cx: 50, cy: 50, inner: 20, outer: 40 };

  it("draws nothing for an empty span", () => {
    expect(arcPath(ring, [1, 1])).toBe("");
  });

  it("draws an annular sector clockwise from twelve o'clock", () => {
    expect(arcPath(ring, [0, Math.PI / 2])).toBe(
      "M50.00 10.00 A40 40 0 0 1 90.00 50.00 L70.00 50.00 A20 20 0 0 0 50.00 30.00 Z"
    );
  });

  it("uses the large arc past half a turn", () => {
    expect(arcPath(ring, [0, Math.PI * 1.5])).toContain("A40 40 0 1 1");
  });
});

describe("stackSpans", () => {
  it("stacks each series on the previous one", () => {
    expect(
      stackSpans(
        [
          [10, 20],
          [5, 6],
        ],
        1
      )
    ).toStrictEqual([
      [0, 20],
      [20, 26],
    ]);
  });
});

describe("staggered", () => {
  it("starts the first item at zero and ends the last at one", () => {
    expect(staggered(0, 0, 3)).toBe(0);
    expect(staggered(1, 2, 3)).toBe(1);
  });

  it("holds later items back", () => {
    expect(staggered(0.2, 2, 3)).toBe(0);
    expect(staggered(0.2, 0, 3)).toBeGreaterThan(0);
  });
});
