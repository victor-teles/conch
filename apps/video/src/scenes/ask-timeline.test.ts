import { describe, expect, it } from "vitest";

import { ASK_CAPTIONS, ASK_TIMELINE, PANEL_HEIGHTS } from "./ask-timeline";

describe("ask timeline", () => {
  it("runs its beats in order", () => {
    const beats = [
      ASK_TIMELINE.panelIn,
      ASK_TIMELINE.typeStart,
      ASK_TIMELINE.submit,
      ASK_TIMELINE.askView,
      ASK_TIMELINE.sqlStart,
      ASK_TIMELINE.runStart,
      ASK_TIMELINE.answer,
      ASK_TIMELINE.end,
    ];
    expect(beats).toStrictEqual([...beats].toSorted((a, b) => a - b));
  });

  it("summons the panel after the hotkey lands", () => {
    const lastKey = Math.max(...ASK_TIMELINE.keys.map((key) => key.down));
    expect(ASK_TIMELINE.panelIn).toBeGreaterThan(lastKey);
  });
});

describe("panel heights", () => {
  it("keeps the answer panel inside a 1080p frame at UI scale", () => {
    const tallest = Math.max(...PANEL_HEIGHTS.map((step) => step.value));
    expect(tallest * 1.55 + 120).toBeLessThan(900);
  });
});

describe("ask captions", () => {
  it("never shows two captions at once", () => {
    const edges = ASK_CAPTIONS.flatMap((cue) => [cue.from, cue.to]);
    expect(edges).toStrictEqual(edges.toSorted((a, b) => a - b));
  });
});
