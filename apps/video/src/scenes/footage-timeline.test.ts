import { describe, expect, it } from "vitest";

import type { Shot } from "@/data/footage";

import { SHOTS } from "@/data/footage";

import { DIP_FRAMES, FOOTAGE, timeFootage } from "./footage-timeline";

const HEADLINE = { body: "Body.", eyebrow: "Ask", title: "Title." };

const shot = (
  id: string,
  clips: Shot["clips"],
  join: Shot["join"] = "dip"
): Shot => ({
  clips,
  headline: HEADLINE,
  id,
  join,
});

describe("timeFootage", () => {
  it("trims each clip from its source second at 30 fps", () => {
    const { clips } = timeFootage([shot("a", [{ from: 10, to: 12 }])]);
    expect(clips).toStrictEqual([
      {
        duration: 60,
        fadeIn: DIP_FRAMES,
        fadeOut: DIP_FRAMES,
        id: "a-0",
        start: 0,
        trimBefore: 300,
      },
    ]);
  });

  it("hard-cuts between clips of one shot and dips at its edges", () => {
    const { clips, shots } = timeFootage([
      shot("a", [
        { from: 0, to: 2 },
        { from: 5, to: 7 },
      ]),
    ]);
    expect(
      clips.map((clip) => [clip.start, clip.fadeIn, clip.fadeOut])
    ).toStrictEqual([
      [0, DIP_FRAMES, 0],
      [60, 0, DIP_FRAMES],
    ]);
    expect(shots[0]?.duration).toBe(120);
  });

  it("hard-cuts into a shot that carries the panel on", () => {
    const { clips } = timeFootage([
      shot("a", [{ from: 0, to: 2 }]),
      shot("b", [{ from: 5, to: 7 }], "cut"),
    ]);
    expect(clips.map((clip) => [clip.fadeIn, clip.fadeOut])).toStrictEqual([
      [DIP_FRAMES, 0],
      [0, DIP_FRAMES],
    ]);
  });

  it("starts each shot where the previous one ends", () => {
    const { shots, duration } = timeFootage([
      shot("a", [{ from: 0, to: 2 }]),
      shot("b", [{ from: 5, to: 7 }]),
    ]);
    expect(shots.map((item) => item.start)).toStrictEqual([0, 60]);
    expect(duration).toBe(120);
  });
});

describe("recorded edit", () => {
  it("plays every clip forward through the take, in order", () => {
    const edges = SHOTS.flatMap((item) =>
      item.clips.flatMap((clip) => [clip.from, clip.to])
    );
    expect(edges).toStrictEqual(edges.toSorted((a, b) => a - b));
  });

  it("holds every clip for at least a second", () => {
    for (const clip of FOOTAGE.clips) {
      expect(clip.duration).toBeGreaterThanOrEqual(30);
    }
  });

  it("stays short enough for a feed", () => {
    expect(FOOTAGE.duration / 30).toBeLessThan(33);
  });
});
