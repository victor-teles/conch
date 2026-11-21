import { describe, expect, it } from "vitest";

import { ORDERS_ASK, REFUSED_ASK } from "@/data/asks";

import {
  beatsFor,
  MONTAGE,
  MONTAGE_CAPTIONS,
  MONTAGE_DURATION,
  MONTAGE_PANEL_HEIGHTS,
} from "./montage-timeline";

const ordered = (beats: ReturnType<typeof beatsFor>) => [
  beats.typeStart,
  beats.submit,
  beats.queryStart,
  beats.runStart,
  beats.answer,
  beats.end,
];

describe("beatsFor", () => {
  it("runs an answered ask's beats in order", () => {
    const beats = ordered(beatsFor({ ask: ORDERS_ASK, kind: "answer" }));
    expect(beats).toStrictEqual(beats.toSorted((a, b) => a - b));
  });

  it("submits only after the prompt is typed", () => {
    const beats = beatsFor({ ask: ORDERS_ASK, kind: "answer" });
    const typed =
      beats.typeStart + (ORDERS_ASK.prompt.length - 1) * beats.framesPerChar;
    expect(beats.submit).toBeGreaterThan(typed);
  });

  it("refuses without a run and holds longer on the refusal", () => {
    const refused = beatsFor({ ask: REFUSED_ASK, kind: "refused" });
    expect(refused.answer - refused.runStart).toBeLessThan(7);
    expect(refused.end - refused.answer).toBeGreaterThan(42);
  });
});

describe("montage", () => {
  it("plays each ask right after the previous one", () => {
    const starts = MONTAGE.map((item) => item.from);
    const ends = MONTAGE.map((item) => item.from + item.beats.end);
    expect(starts.slice(1)).toStrictEqual(ends.slice(0, -1));
  });

  it("ends on the refusal", () => {
    expect(MONTAGE.at(-1)?.entry.kind).toBe("refused");
  });

  it("lasts as long as its items", () => {
    const total = MONTAGE.reduce((sum, item) => sum + item.beats.end, 0);
    expect(MONTAGE_DURATION).toBe(total);
  });

  it("never shows two captions at once", () => {
    const edges = MONTAGE_CAPTIONS.flatMap((cue) => [cue.from, cue.to]);
    expect(edges).toStrictEqual(edges.toSorted((a, b) => a - b));
  });
});

describe("montage panel heights", () => {
  it("shrinks the panel once, to fit the refusal", () => {
    const heights = MONTAGE_PANEL_HEIGHTS.map((step) => step.value);
    expect(heights).toHaveLength(2);
    expect(heights).toStrictEqual(heights.toSorted((a, b) => b - a));
  });
});
