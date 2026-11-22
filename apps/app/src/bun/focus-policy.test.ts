import { describe, expect, it } from "vitest";

import { focusAfterLauncherHides } from "./focus-policy.ts";

describe("focusAfterLauncherHides", () => {
  it("keeps activation when a board took focus", () => {
    expect(
      focusAfterLauncherHides({
        focusedWindowKey: "b1",
        openWindowKeys: ["b1"],
        returnWindowKey: null,
      })
    ).toStrictEqual({ kind: "keep" });
  });

  it("returns to the board that summoned the launcher", () => {
    expect(
      focusAfterLauncherHides({
        focusedWindowKey: null,
        openWindowKeys: ["b1", "b2"],
        returnWindowKey: "b2",
      })
    ).toStrictEqual({ kind: "activate", windowKey: "b2" });
  });

  it("deactivates without hiding when boards stay open", () => {
    expect(
      focusAfterLauncherHides({
        focusedWindowKey: null,
        openWindowKeys: ["b1"],
        returnWindowKey: "gone",
      })
    ).toStrictEqual({ kind: "deactivate" });
  });

  it("hides the app when nothing else is open", () => {
    expect(
      focusAfterLauncherHides({
        focusedWindowKey: null,
        openWindowKeys: [],
        returnWindowKey: null,
      })
    ).toStrictEqual({ kind: "hide" });
  });

  it("returns to an app window by its key", () => {
    expect(
      focusAfterLauncherHides({
        focusedWindowKey: null,
        openWindowKeys: ["b1", "app:a1"],
        returnWindowKey: "app:a1",
      })
    ).toStrictEqual({ kind: "activate", windowKey: "app:a1" });
  });
});
