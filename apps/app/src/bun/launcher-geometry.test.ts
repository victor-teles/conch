import { describe, expect, it } from "vitest";

import {
  clampLauncherHeight,
  heightRoom,
  LAUNCHER_MAX_HEIGHT,
  LAUNCHER_MIN_HEIGHT,
  LAUNCHER_WINDOW_WIDTH,
  launcherFrame,
  resizedFrame,
  workAreaForPoint,
} from "./launcher-geometry";

const primary = { height: 900, width: 1440, x: 0, y: 25 };
const secondary = { height: 1080, width: 1920, x: 1440, y: 0 };

describe("clampLauncherHeight", () => {
  it("rounds fractional heights up", () => {
    expect(clampLauncherHeight(120.2)).toBe(121);
  });

  it("keeps heights inside the launcher bounds", () => {
    expect(clampLauncherHeight(10)).toBe(LAUNCHER_MIN_HEIGHT);
    expect(clampLauncherHeight(5000)).toBe(LAUNCHER_MAX_HEIGHT);
  });
});

describe("workAreaForPoint", () => {
  it("picks the display under the cursor", () => {
    expect(
      workAreaForPoint([primary, secondary], { x: 2000, y: 400 }, primary)
    ).toBe(secondary);
  });

  it("falls back when the cursor is outside every display", () => {
    expect(
      workAreaForPoint([primary, secondary], { x: -50, y: -50 }, primary)
    ).toBe(primary);
  });
});

describe("launcherFrame", () => {
  it("centers horizontally and sits at 22% of the work area", () => {
    expect(launcherFrame(primary, 64)).toStrictEqual({
      height: 64,
      width: LAUNCHER_WINDOW_WIDTH,
      x: 320,
      y: 223,
    });
  });

  it("offsets by the display origin", () => {
    const frame = launcherFrame(secondary, 300);
    expect(frame.x).toBe(1440 + 560);
    expect(frame.y).toBe(238);
  });
});

describe("resizedFrame", () => {
  it("keeps the top edge fixed while the height changes", () => {
    const current = launcherFrame(primary, 64);
    expect(resizedFrame(current, 420)).toStrictEqual({
      ...current,
      height: 420,
    });
  });
});

describe("heightRoom", () => {
  const laptop = { height: 875, width: 1512, x: 0, y: 25 };
  const tall = { height: 1415, width: 2560, x: 0, y: 25 };

  it("ends the window at the bottom of the work area on a short display", () => {
    const frame = launcherFrame(laptop, 5000);
    expect(heightRoom(laptop)).toBe(682);
    expect(frame.y + frame.height).toBeLessThanOrEqual(
      laptop.y + laptop.height
    );
  });

  it("keeps the usual cap on a tall display", () => {
    expect(heightRoom(tall)).toBe(LAUNCHER_MAX_HEIGHT);
  });

  it("caps a resize at the room it was shown with", () => {
    const current = launcherFrame(laptop, 64);
    expect(resizedFrame(current, 5000, heightRoom(laptop)).height).toBe(682);
  });
});
